// Load .env file if present
const _envPath = require('path').join(__dirname, '.env');
if (require('fs').existsSync(_envPath)) {
  require('fs').readFileSync(_envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  });
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');

const { spawn } = require('child_process');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_HTTP_PORT = process.env.BOT_PORT || 3001;

// ===== LAUNCH PYTHON BOT =====
function startBot() {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const botProcess = spawn(pythonCmd, ['bot.py'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUTF8: '1' }
  });
  botProcess.stdout.on('data', d => process.stdout.write(d));
  botProcess.stderr.on('data', d => process.stderr.write(d));
  botProcess.on('close', code => {
    console.log(`  Bot process exited (code ${code}), restarting in 5s...`);
    setTimeout(startBot, 5000);
  });
}

function notifyBot(email) {
  const data = JSON.stringify({ email });
  const req = http.request({
    hostname: '127.0.0.1',
    port: BOT_HTTP_PORT,
    path: '/',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  });
  req.on('error', () => {});
  req.write(data);
  req.end();
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'viz-studio-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/Local', express.static(path.join(__dirname, 'Local')));

// ===== MULTER (file uploads) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  }
});

// ===== DATABASE =====
const DB_PATH = path.join(__dirname, 'database.sqlite');
let db;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    year TEXT DEFAULT '',
    description TEXT DEFAULT '',
    role TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    media TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    section TEXT DEFAULT 'author',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrate: add section column if missing
  try { db.run("ALTER TABLE projects ADD COLUMN section TEXT DEFAULT 'author'"); } catch (e) { /* already exists */ }

  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tag TEXT DEFAULT 'YouTube',
    subscribers TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    initials TEXT DEFAULT '',
    url TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    notified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed default data if empty
  const projectCount = db.exec("SELECT COUNT(*) as c FROM projects")[0]?.values[0][0] || 0;
  if (projectCount === 0) {
    const defaultProjects = [
      {
        name: 'BenAzelart — Season Opener',
        category: 'YouTube · 3D Animation',
        year: '2026',
        description: 'A fully animated 3D intro sequence for one of YouTube\'s biggest creators. The brief was to create a cinematic, high-energy opener that captures the spirit of the channel.',
        duration: '3 weeks',
        tags: JSON.stringify(['Blender', 'After Effects', 'Animation', '3D Modeling']),
        media: JSON.stringify([
          { type: 'video', src: '/Videos/1110400_Tongue_Licking_1280x720.mp4' },
          { type: 'image', src: '/Photos/png1.jpg' }
        ]),
        sort_order: 0,
        section: 'author'
      },
      {
        name: 'John Nellis — Brand Pack',
        category: 'YouTube · Motion Graphics',
        year: '2025',
        description: 'A complete visual brand package including animated thumbnails, channel overlays, and dynamic transitions. Designed to elevate the channel\'s visual identity.',
        duration: '2 weeks',
        tags: JSON.stringify(['Cinema 4D', 'After Effects', 'Branding', 'Motion Graphics']),
        media: JSON.stringify([
          { type: 'image', src: '/Photos/png1.jpg' },
          { type: 'video', src: '/Videos/1110400_Tongue_Licking_1280x720.mp4' }
        ]),
        sort_order: 1,
        section: 'commercial'
      },
      {
        name: 'Matthew Beem — Ad Integration',
        category: 'YouTube · Product Visual',
        year: '2025',
        description: 'Photorealistic 3D product showcases designed for seamless sponsor integrations. Each product was modeled, textured, and lit to match the channel\'s visual tone.',
        duration: '1 week',
        tags: JSON.stringify(['Blender', 'Substance 3D', 'Product Viz', 'Rendering']),
        media: JSON.stringify([
          { type: 'video', src: '/Videos/1110400_Tongue_Licking_1280x720.mp4' },
          { type: 'image', src: '/Photos/png1.jpg' }
        ]),
        sort_order: 2,
        section: 'commercial'
      }
    ];

    const stmt = db.prepare("INSERT INTO projects (name, category, year, description, duration, tags, media, sort_order, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const p of defaultProjects) {
      stmt.run([p.name, p.category, p.year, p.description, p.duration, p.tags, p.media, p.sort_order, p.section]);
    }
    stmt.free();
  }

  const clientCount = db.exec("SELECT COUNT(*) as c FROM clients")[0]?.values[0][0] || 0;
  if (clientCount === 0) {
    const defaultClients = [
      { name: 'Ben Azelart',      description: '3D Art & Creative Content', tag: 'YouTube', subscribers: '49.5M', avatar_url: '/Avatars/BenAzelart.jpg',    initials: 'BA', url: 'https://www.youtube.com/@BenAzelart',    sort_order: 0 },
      { name: 'John Nellis',      description: 'Entertainment & Lifestyle', tag: 'YouTube', subscribers: '13.3M', avatar_url: '/Avatars/John Nellis.jpg',    initials: 'JN', url: 'https://www.youtube.com/@JohnNellis',    sort_order: 1 },
      { name: 'Matthew Beem',     description: 'Challenge & Vlogs',         tag: 'YouTube', subscribers: '8M',    avatar_url: '/Avatars/Matthew Beem.jpg',   initials: 'MB', url: 'https://www.youtube.com/@MatthewBeem',   sort_order: 2 },
      { name: 'Paradeevich',      description: 'Entertainment & Shows',     tag: 'YouTube', subscribers: '2.45M', avatar_url: '/Avatars/Paradevich.jpg',     initials: 'PA', url: 'https://www.youtube.com/@paradeevich',   sort_order: 3 },
      { name: 'Danila Gorilla',   description: 'Reactions & Reviews',       tag: 'YouTube', subscribers: '438K',  avatar_url: '/Avatars/DanilaGoeila.jpg',   initials: 'DG', url: 'https://www.youtube.com/@Danila.Gorilla', sort_order: 4 }
    ];

    const stmt = db.prepare("INSERT INTO clients (name, description, tag, subscribers, avatar_url, initials, url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const c of defaultClients) {
      stmt.run([c.name, c.description, c.tag, c.subscribers, c.avatar_url, c.initials, c.url, c.sort_order]);
    }
    stmt.free();
  }

  saveDB();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper to run queries
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ===== AUTH MIDDLEWARE =====
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ===== AUTH ROUTES =====
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (bcrypt.compareSync(password || '', ADMIN_PASSWORD_HASH)) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ===== PUBLIC API =====
app.get('/api/projects', (req, res) => {
  const rows = dbAll("SELECT * FROM projects ORDER BY sort_order ASC");
  rows.forEach(r => {
    r.tags = JSON.parse(r.tags || '[]');
    r.media = JSON.parse(r.media || '[]');
  });
  res.json(rows);
});

app.get('/api/clients', (req, res) => {
  const rows = dbAll("SELECT * FROM clients ORDER BY sort_order ASC");
  res.json(rows);
});

// ===== ADMIN API: PROJECTS =====
app.post('/api/admin/projects', requireAdmin, (req, res) => {
  try {
    const { name, category, year, description, duration, tags, media, sort_order, section } = req.body;
    dbRun(
      "INSERT INTO projects (name, category, year, description, duration, tags, media, sort_order, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name, category || '', year || '', description || '', duration || '', JSON.stringify(tags || []), JSON.stringify(media || []), sort_order || 0, section || 'author']
    );
    res.json({ success: true, id: db.exec("SELECT last_insert_rowid()")[0].values[0][0] });
  } catch (e) {
    console.error('POST /api/admin/projects error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/projects/:id', requireAdmin, (req, res) => {
  try {
    const { name, category, year, description, duration, tags, media, sort_order, section } = req.body;
    dbRun(
      "UPDATE projects SET name=?, category=?, year=?, description=?, duration=?, tags=?, media=?, sort_order=?, section=? WHERE id=?",
      [name, category || '', year || '', description || '', duration || '', JSON.stringify(tags || []), JSON.stringify(media || []), sort_order || 0, section || 'author', req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/admin/projects error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  // Clean up uploaded media files
  const rows = dbAll("SELECT media FROM projects WHERE id=?", [req.params.id]);
  if (rows[0]) {
    try {
      const media = JSON.parse(rows[0].media || '[]');
      media.forEach(m => {
        if (m.src && m.src.startsWith('/uploads/')) {
          const fp = path.join(__dirname, 'public', m.src);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      });
    } catch {}
  }
  dbRun("DELETE FROM projects WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

app.post('/api/admin/projects/reorder', requireAdmin, (req, res) => {
  const { order } = req.body; // array of { id, sort_order }
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order' });
  order.forEach(item => {
    dbRun("UPDATE projects SET sort_order=? WHERE id=?", [item.sort_order, item.id]);
  });
  res.json({ success: true });
});

// ===== ADMIN API: CLIENTS =====
app.post('/api/admin/clients', requireAdmin, (req, res) => {
  const { name, description, tag, subscribers, avatar_url, initials, url, sort_order } = req.body;
  dbRun(
    "INSERT INTO clients (name, description, tag, subscribers, avatar_url, initials, url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description || '', tag || 'YouTube', subscribers || '', avatar_url || '', initials || '', url || '', sort_order || 0]
  );
  res.json({ success: true, id: db.exec("SELECT last_insert_rowid()")[0].values[0][0] });
});

app.put('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const { name, description, tag, subscribers, avatar_url, initials, url, sort_order } = req.body;
  dbRun(
    "UPDATE clients SET name=?, description=?, tag=?, subscribers=?, avatar_url=?, initials=?, url=?, sort_order=? WHERE id=?",
    [name, description || '', tag || 'YouTube', subscribers || '', avatar_url || '', initials || '', url || '', sort_order || 0, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/admin/clients/:id', requireAdmin, (req, res) => {
  dbRun("DELETE FROM clients WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

// ===== FILE UPLOAD =====
app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  res.json({ success: true, url, filename: req.file.filename });
});

app.delete('/api/admin/upload/:filename', requireAdmin, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// ===== PUBLIC API: SETTINGS =====
app.get('/api/settings/:key', (req, res) => {
  const rows = dbAll("SELECT value FROM settings WHERE key=?", [req.params.key]);
  res.json({ value: rows[0]?.value || '' });
});

// ===== ADMIN API: SETTINGS =====
app.put('/api/admin/settings/:key', requireAdmin, (req, res) => {
  const { value } = req.body;
  const exists = dbAll("SELECT key FROM settings WHERE key=?", [req.params.key]);
  if (exists.length) {
    dbRun("UPDATE settings SET value=? WHERE key=?", [value || '', req.params.key]);
  } else {
    dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", [req.params.key, value || '']);
  }
  res.json({ success: true });
});

// ===== CONTACT (email -> DB + Bot) =====
app.post('/api/contact', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  dbRun("INSERT INTO contacts (email) VALUES (?)", [email]);
  notifyBot(email);
  res.json({ success: true });
});

// ===== BOT POLLING API (bot fetches new contacts) =====
app.get('/api/bot/contacts', (req, res) => {
  const secret = req.query.secret;
  if (secret !== (process.env.BOT_SECRET || 'viz-bot-secret-2026')) return res.status(403).json({ error: 'Forbidden' });
  const rows = dbAll("SELECT id, email, created_at FROM contacts WHERE notified = 0 ORDER BY id ASC");
  res.json(rows);
});

app.post('/api/bot/contacts/mark', (req, res) => {
  const secret = req.query.secret;
  if (secret !== (process.env.BOT_SECRET || 'viz-bot-secret-2026')) return res.status(403).json({ error: 'Forbidden' });
  const { ids } = req.body;
  if (ids && ids.length) {
    dbRun(`UPDATE contacts SET notified = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  }
  res.json({ success: true });
});

// ===== ADMIN PAGE =====
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== SPA FALLBACK =====
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START =====
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Leywin server running at http://localhost:${PORT}\n`);
    startBot();
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
