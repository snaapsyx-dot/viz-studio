// ===== STATE =====
let projects = [];
let clients = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/admin/check');
  const { isAdmin } = await check.json();
  if (!isAdmin) { location.href = '/'; return; }
  await loadAll();
});

async function loadAll() {
  const [pRes, cRes] = await Promise.all([fetch('/api/projects'), fetch('/api/clients')]);
  projects = await pRes.json();
  clients = await cRes.json();
  renderProjectsTable();
  renderClientsTable();
}

// ===== TABS =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-projects').style.display = tab === 'projects' ? '' : 'none';
  document.getElementById('tab-clients').style.display = tab === 'clients' ? '' : 'none';
}

// ===== STATUS =====
function showStatus(msg, type = 'success') {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  setTimeout(() => { el.className = 'status-msg'; }, 3000);
}

// ===== LOGOUT =====
async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.href = '/';
}

// ===== FILE UPLOAD =====
async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return await res.json();
}

// ===== HELPERS =====
function getAllTags() {
  const set = new Set();
  projects.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function getAllCategories() {
  const set = new Set();
  projects.forEach(p => { if (p.category) set.add(p.category); });
  return [...set].sort();
}

// ========================
// PROJECTS
// ========================
function renderProjectsTable() {
  const el = document.getElementById('projectsList');
  const authorProjects = projects.filter(p => (p.section || 'author') === 'author');
  const commercialProjects = projects.filter(p => (p.section || 'author') === 'commercial');

  if (!projects.length) {
    el.innerHTML = '<div class="empty-state">No projects yet. Click "+ Add Project" to create one.</div>';
    return;
  }

  function tableHTML(items, label) {
    if (!items.length) return `<div class="section-divider">${label}</div><div class="empty-state" style="margin-bottom:24px">No ${label.toLowerCase()} yet.</div>`;
    return `
      <div class="section-divider">${label}</div>
      <div class="table-wrap" style="margin-bottom:24px">
        <table>
          <thead><tr>
            <th>Name</th><th>Category</th><th>Year</th><th>Media</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${items.map(p => `
              <tr>
                <td class="cell-name">${esc(p.name)}</td>
                <td><span class="cell-tag">${esc(p.category)}</span></td>
                <td>${esc(p.year)}</td>
                <td>${(p.media || []).length} files</td>
                <td class="cell-actions">
                  <button class="btn btn-outline btn-small" onclick="editProject(${p.id})">Edit</button>
                  <button class="btn btn-danger btn-small" onclick="deleteProject(${p.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  el.innerHTML = tableHTML(authorProjects, 'Author Videos') + tableHTML(commercialProjects, 'Commercial Videos');
}

function showProjectForm(project = null) {
  const form = document.getElementById('projectForm');
  const list = document.getElementById('projectsList');
  list.style.display = 'none';
  form.style.display = '';

  const p = project || { name: '', category: '', year: '', description: '', duration: '', tags: [], media: [], sort_order: 0, section: 'author', layout: 'normal' };
  const isEdit = !!project;

  const tagsChips = (p.tags || []).map(t =>
    `<span class="tag-chip">${esc(t)} <button onclick="this.parentElement.remove()">&times;</button></span>`
  ).join('');

  form.innerHTML = `
    <button class="btn-back" onclick="hideProjectForm()">&larr; Back to list</button>
    <h3 class="form-title" style="margin-top:16px">${isEdit ? 'Edit' : 'New'} Project</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="pf-name" value="${esc(p.name)}" placeholder="Project name">
      </div>
      <div class="form-group" style="position:relative">
        <label class="form-label">Category</label>
        <input class="form-input" id="pf-category" value="${esc(p.category)}" placeholder="YouTube · 3D Animation" autocomplete="off">
        <div class="ac-dropdown" id="pf-cat-dd"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Year</label>
        <input class="form-input" id="pf-year" value="${esc(p.year)}" placeholder="2026">
      </div>
      <div class="form-group">
        <label class="form-label">Section</label>
        <select class="form-input" id="pf-section">
          <option value="author" ${(p.section || 'author') === 'author' ? 'selected' : ''}>Author Videos</option>
          <option value="commercial" ${(p.section || 'author') === 'commercial' ? 'selected' : ''}>Commercial Videos</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Layout</label>
        <select class="form-input" id="pf-layout">
          <option value="normal" ${(p.layout || 'normal') === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="wide" ${p.layout === 'wide' ? 'selected' : ''}>Wide (horizontal)</option>
          <option value="tall" ${p.layout === 'tall' ? 'selected' : ''}>Tall (vertical)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Duration</label>
        <input class="form-input" id="pf-duration" value="${esc(p.duration)}" placeholder="2 weeks">
      </div>
      <div class="form-group">
        <label class="form-label">Sort Order</label>
        <input class="form-input" type="number" id="pf-sort" value="${p.sort_order || 0}">
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="pf-desc" placeholder="Project description...">${esc(p.description)}</textarea>
      </div>
      <div class="form-group full" style="position:relative">
        <label class="form-label">Tags (press Enter to add)</label>
        <div class="tags-input-wrap" id="pf-tags-wrap">
          ${tagsChips}
          <input class="tags-input" id="pf-tags-input" placeholder="Add tag..." autocomplete="off">
        </div>
        <div class="ac-dropdown" id="pf-tags-dd"></div>
      </div>
      <div class="form-group full">
        <label class="form-label">Media</label>
        <div class="media-list" id="pf-media">
          ${(p.media || []).map((m, i) => mediaItemHTML(m, i)).join('')}
          <label class="media-add" id="pf-media-add">
            +
            <input type="file" accept="image/*,video/*" style="display:none" onchange="addProjectMedia(this)">
          </label>
          <button class="media-add" type="button" id="pf-media-yt" onclick="toggleDashYtPanel()" style="font-size:12px;color:red;font-weight:700">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="red"><path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.5.6c-1 .3-1.8 1-2 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1 1.8 2 2.1 1.9.6 9.5.6 9.5.6s7.6 0 9.5-.6c1-.3 1.8-1 2-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.5v-7l6.4 3.5-6.4 3.5z"/></svg>
          </button>
          <button class="media-add" type="button" id="pf-media-tt" onclick="toggleDashTtPanel()" style="font-size:12px;color:#fff;font-weight:700;background:#000">
            <svg viewBox="0 0 48 48" width="18" height="18" fill="#fff"><path d="M38.4 21.7V16c-3.1 0-5.5-1-7.2-2.9-1.6-1.9-2.4-4.3-2.4-7.1h-5.7v23.5c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.6 0 1.1.1 1.6.3V18.5c-.5-.1-1.1-.1-1.6-.1-6.2 0-11.2 5-11.2 11.2S11.5 40.8 17.7 40.8s11.2-5 11.2-11.2V19.8c2.4 1.7 5.3 2.7 8.5 2.7v-0.8z"/></svg>
          </button>
        </div>
        <div id="pf-yt-panel" style="display:none"></div>
        <div id="pf-tt-panel" style="display:none"></div>
      </div>
    </div>
    <div style="margin-top:24px;display:flex;gap:12px">
      <button class="btn btn-primary" onclick="saveProject(${isEdit ? p.id : 'null'})">${isEdit ? 'Save Changes' : 'Create Project'}</button>
      <button class="btn btn-outline" onclick="hideProjectForm()">Cancel</button>
    </div>
  `;

  // Tags input handler
  const tagsInp = document.getElementById('pf-tags-input');
  tagsInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      addTagChip(e.target.value.trim());
      e.target.value = '';
      hideDd('pf-tags-dd');
    }
  });
  tagsInp.addEventListener('focus', () => showTagsDd());
  tagsInp.addEventListener('input', () => showTagsDd());

  // Category autocomplete
  const catInp = document.getElementById('pf-category');
  catInp.addEventListener('focus', () => showCatDd());
  catInp.addEventListener('input', () => showCatDd());

  // Close dropdowns on outside click
  document.addEventListener('click', closeDropdowns);
}

function addTagChip(tag) {
  const wrap = document.getElementById('pf-tags-wrap');
  const inp = document.getElementById('pf-tags-input');
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.innerHTML = `${esc(tag)} <button onclick="this.parentElement.remove()">&times;</button>`;
  wrap.insertBefore(chip, inp);
}

function showTagsDd() {
  const inp = document.getElementById('pf-tags-input');
  const dd = document.getElementById('pf-tags-dd');
  if (!inp || !dd) return;
  const val = inp.value.toLowerCase();
  const existing = [...document.querySelectorAll('#pf-tags-wrap .tag-chip')].map(c => c.textContent.replace('×', '').trim().toLowerCase());
  const filtered = getAllTags().filter(t => !existing.includes(t.toLowerCase()) && (!val || t.toLowerCase().includes(val)));
  if (!filtered.length) { dd.innerHTML = ''; dd.classList.remove('open'); return; }
  dd.innerHTML = filtered.map(t => `<div class="ac-item" onmousedown="addTagChip('${esc(t)}'); hideDd('pf-tags-dd'); document.getElementById('pf-tags-input').value=''">${t}</div>`).join('');
  dd.classList.add('open');
}

function showCatDd() {
  const inp = document.getElementById('pf-category');
  const dd = document.getElementById('pf-cat-dd');
  if (!inp || !dd) return;
  const val = inp.value.toLowerCase();
  const filtered = getAllCategories().filter(c => !val || c.toLowerCase().includes(val));
  if (!filtered.length) { dd.innerHTML = ''; dd.classList.remove('open'); return; }
  dd.innerHTML = filtered.map(c => `<div class="ac-item" onmousedown="document.getElementById('pf-category').value='${esc(c)}'; hideDd('pf-cat-dd')">${c}</div>`).join('');
  dd.classList.add('open');
}

function hideDd(id) {
  const dd = document.getElementById(id);
  if (dd) { dd.innerHTML = ''; dd.classList.remove('open'); }
}

function closeDropdowns(e) {
  if (!e.target.closest('#pf-tags-dd') && !e.target.closest('#pf-tags-input')) hideDd('pf-tags-dd');
  if (!e.target.closest('#pf-cat-dd') && !e.target.closest('#pf-category')) hideDd('pf-cat-dd');
}

function mediaItemHTML(m, idx) {
  const isVideo = m.type === 'video';
  const isYT = m.type === 'youtube';
  const isTT = m.type === 'tiktok';
  let preview;
  if (isYT) {
    const thumb = m.thumb || `https://img.youtube.com/vi/${getYTId(m.src)}/maxresdefault.jpg`;
    preview = `<img src="${thumb}" alt=""><div style="position:absolute;top:3px;left:3px;background:red;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">YT</div>`;
  } else if (isTT) {
    const thumb = m.thumb || '';
    preview = thumb
      ? `<img src="${thumb}" alt=""><div style="position:absolute;top:3px;left:3px;background:#000;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">TT</div>`
      : `<div style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 48 48" width="20" height="20" fill="#fff"><path d="M38.4 21.7V16c-3.1 0-5.5-1-7.2-2.9-1.6-1.9-2.4-4.3-2.4-7.1h-5.7v23.5c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.6 0 1.1.1 1.6.3V18.5c-.5-.1-1.1-.1-1.6-.1-6.2 0-11.2 5-11.2 11.2S11.5 40.8 17.7 40.8s11.2-5 11.2-11.2V19.8c2.4 1.7 5.3 2.7 8.5 2.7v-0.8z"/></svg></div><div style="position:absolute;top:3px;left:3px;background:#000;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">TT</div>`;
  } else if (isVideo) {
    preview = `<video src="${m.src}" muted></video>`;
  } else {
    preview = `<img src="${m.src}" alt="">`;
  }
  return `
    <div class="media-item" data-src="${esc(m.src)}" data-type="${m.type}"${m.start ? ` data-start="${m.start}"` : ''}${m.end ? ` data-end="${m.end}"` : ''}${m.thumb ? ` data-thumb="${esc(m.thumb)}"` : ''}>
      ${preview}
      <button class="media-item-remove" onclick="this.parentElement.remove()">&times;</button>
    </div>
  `;
}

function getYTId(url) {
  if (!url) return '';
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

function getTTId(url) {
  if (!url) return '';
  const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return m ? m[1] : '';
}

async function addProjectMedia(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const result = await uploadFile(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const item = document.createElement('div');
    item.className = 'media-item';
    item.dataset.src = result.url;
    item.dataset.type = type;
    item.innerHTML = (type === 'video'
      ? `<video src="${result.url}" muted></video>`
      : `<img src="${result.url}" alt="">`)
      + `<button class="media-item-remove" onclick="this.parentElement.remove()">&times;</button>`;

    const addBtn = document.getElementById('pf-media-add');
    addBtn.parentElement.insertBefore(item, addBtn);
    input.value = '';
    showStatus('File uploaded successfully.');
  } catch {
    showStatus('Upload failed.', 'error');
  }
}

// ===== YOUTUBE PANEL (dashboard) =====
function toggleDashYtPanel() {
  const panel = document.getElementById('pf-yt-panel');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; panel.innerHTML = ''; return; }

  panel.style.display = '';
  panel.innerHTML = `
    <div style="margin-top:12px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--r)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="red"><path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.5.6c-1 .3-1.8 1-2 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1 1.8 2 2.1 1.9.6 9.5.6 9.5.6s7.6 0 9.5-.6c1-.3 1.8-1 2-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.5v-7l6.4 3.5-6.4 3.5z"/></svg>
        <span style="font-size:13px;font-weight:600">Add YouTube Video</span>
      </div>
      <input class="form-input" id="pf-yt-url" placeholder="https://youtube.com/watch?v=..." style="width:100%;margin-bottom:8px">
      <div id="pf-yt-preview" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <div style="flex:1"><label class="form-label" style="margin-bottom:4px">Start</label><input class="form-input pf-yt-time" id="pf-yt-start" placeholder="0:00" inputmode="numeric" style="width:100%"></div>
        <div style="flex:1"><label class="form-label" style="margin-bottom:4px">End</label><input class="form-input pf-yt-time" id="pf-yt-end" placeholder="0:00" inputmode="numeric" style="width:100%"></div>
      </div>
      <div style="margin-bottom:10px">
        <label class="form-label" style="margin-bottom:4px">Custom thumbnail (optional)</label>
        <label class="btn btn-outline btn-small" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload
          <input type="file" accept="image/*,video/*" style="display:none" onchange="dashYtThumbUpload(this)">
        </label>
        <div id="pf-yt-thumb-preview" style="margin-top:6px"></div>
        <input type="hidden" id="pf-yt-thumb-url" value="">
      </div>
      <button class="btn btn-primary btn-small" onclick="confirmDashYt()">Add Video</button>
      <button class="btn btn-outline btn-small" onclick="document.getElementById('pf-yt-panel').style.display='none'">Cancel</button>
    </div>
  `;

  // Live preview
  const inp = document.getElementById('pf-yt-url');
  inp.addEventListener('input', () => {
    const prev = document.getElementById('pf-yt-preview');
    const id = getYTId(inp.value);
    if (id) {
      prev.innerHTML = `<img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" style="width:100%;border-radius:8px;max-width:280px">`;
    } else { prev.innerHTML = ''; }
  });

  // Auto-format time on blur
  panel.querySelectorAll('.pf-yt-time').forEach(ti => {
    ti.addEventListener('blur', () => {
      if (ti.value.trim()) ti.value = dashFormatTime(ti.value);
    });
  });

  setTimeout(() => inp.focus(), 50);
}

function dashParseTime(val) {
  const digits = val.replace(/\D/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  if (n < 100) return n;
  if (n < 10000) return Math.floor(n / 100) * 60 + (n % 100);
  return Math.floor(n / 10000) * 3600 + Math.floor((n % 10000) / 100) * 60 + (n % 100);
}

function dashFormatTime(val) {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (n < 100) return `0:${String(n).padStart(2, '0')}`;
  if (n < 10000) return `${Math.floor(n / 100)}:${String(n % 100).padStart(2, '0')}`;
  return `${Math.floor(n / 10000)}:${String(Math.floor((n % 10000) / 100)).padStart(2, '0')}:${String(n % 100).padStart(2, '0')}`;
}

function dashSecondsToHMS(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

async function dashYtThumbUpload(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const result = await uploadFile(file);
    document.getElementById('pf-yt-thumb-url').value = result.url;
    const prev = document.getElementById('pf-yt-thumb-preview');
    if (file.type.startsWith('video')) {
      prev.innerHTML = `<video src="${result.url}" muted autoplay loop style="width:100%;max-width:200px;border-radius:8px"></video>`;
    } else {
      prev.innerHTML = `<img src="${result.url}" style="width:100%;max-width:200px;border-radius:8px">`;
    }
    showStatus('Thumbnail uploaded.');
  } catch { showStatus('Upload failed.', 'error'); }
}

function confirmDashYt() {
  const url = document.getElementById('pf-yt-url').value.trim();
  if (!url) return;
  const ytId = getYTId(url);
  if (!ytId) { showStatus('Invalid YouTube URL', 'error'); return; }

  const startSec = dashParseTime(document.getElementById('pf-yt-start')?.value || '');
  const endSec = dashParseTime(document.getElementById('pf-yt-end')?.value || '');
  const thumbUrl = document.getElementById('pf-yt-thumb-url')?.value || '';

  const m = { type: 'youtube', src: url };
  if (startSec) m.start = startSec;
  if (endSec) m.end = endSec;
  if (thumbUrl) m.thumb = thumbUrl;

  const item = document.createElement('div');
  item.className = 'media-item';
  item.dataset.src = url;
  item.dataset.type = 'youtube';
  if (startSec) item.dataset.start = startSec;
  if (endSec) item.dataset.end = endSec;
  if (thumbUrl) item.dataset.thumb = thumbUrl;

  const thumb = thumbUrl || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  const timeLabel = (startSec || endSec) ? `<div style="position:absolute;bottom:3px;left:3px;background:rgba(0,0,0,0.7);color:#fff;font-size:8px;padding:1px 4px;border-radius:3px">${dashSecondsToHMS(startSec)}${endSec ? ' - ' + dashSecondsToHMS(endSec) : ''}</div>` : '';
  item.innerHTML = `<img src="${thumb}" alt=""><div style="position:absolute;top:3px;left:3px;background:red;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">YT</div>${timeLabel}<button class="media-item-remove" onclick="this.parentElement.remove()">&times;</button>`;

  const addBtn = document.getElementById('pf-media-add');
  addBtn.parentElement.insertBefore(item, addBtn);

  document.getElementById('pf-yt-panel').style.display = 'none';
  document.getElementById('pf-yt-panel').innerHTML = '';
  showStatus('YouTube video added.');
}

function getProjectFormData() {
  const tags = [...document.querySelectorAll('#pf-tags-wrap .tag-chip')].map(c => c.textContent.replace('×', '').trim());
  const media = [...document.querySelectorAll('#pf-media .media-item')].map(el => {
    const obj = { type: el.dataset.type, src: el.dataset.src };
    if (el.dataset.start) obj.start = +el.dataset.start;
    if (el.dataset.end) obj.end = +el.dataset.end;
    if (el.dataset.thumb) obj.thumb = el.dataset.thumb;
    return obj;
  });

  return {
    name: document.getElementById('pf-name').value,
    category: document.getElementById('pf-category').value,
    year: document.getElementById('pf-year').value,
    description: document.getElementById('pf-desc').value,
    duration: document.getElementById('pf-duration').value,
    sort_order: +document.getElementById('pf-sort').value || 0,
    section: document.getElementById('pf-section').value,
    layout: document.getElementById('pf-layout').value,
    tags,
    media
  };
}

async function saveProject(id) {
  const data = getProjectFormData();
  if (!data.name) { showStatus('Name is required.', 'error'); return; }

  const url = id ? `/api/admin/projects/${id}` : '/api/admin/projects';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showStatus(id ? 'Project updated.' : 'Project created.');
    hideProjectForm();
    await loadAll();
  } else {
    showStatus('Failed to save.', 'error');
  }
}

function editProject(id) {
  const p = projects.find(x => x.id === id);
  if (p) showProjectForm(p);
}

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
  if (res.ok) { showStatus('Project deleted.'); await loadAll(); }
}

function hideProjectForm() {
  document.getElementById('projectForm').style.display = 'none';
  document.getElementById('projectsList').style.display = '';
  document.removeEventListener('click', closeDropdowns);
}

// ========================
// CLIENTS
// ========================
function renderClientsTable() {
  const el = document.getElementById('clientsList');
  if (!clients.length) {
    el.innerHTML = '<div class="empty-state">No clients yet. Click "+ Add Client" to create one.</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th></th><th>Name</th><th>Description</th><th>Subscribers</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${clients.map(c => `
            <tr>
              <td>
                <div class="cell-avatar">
                  ${c.avatar_url ? `<img src="${c.avatar_url}" alt="">` : (c.initials || c.name.slice(0, 2).toUpperCase())}
                </div>
              </td>
              <td class="cell-name">${esc(c.name)}</td>
              <td style="color:var(--dim)">${esc(c.description)}</td>
              <td>${esc(c.subscribers || '—')}</td>
              <td class="cell-actions">
                <button class="btn btn-outline btn-small" onclick="editClient(${c.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deleteClient(${c.id})">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showClientForm(client = null) {
  const form = document.getElementById('clientForm');
  const list = document.getElementById('clientsList');
  list.style.display = 'none';
  form.style.display = '';

  const c = client || { name: '', description: '', tag: 'YouTube', subscribers: '', avatar_url: '', initials: '', url: '', sort_order: 0 };
  const isEdit = !!client;

  form.innerHTML = `
    <button class="btn-back" onclick="hideClientForm()">&larr; Back to list</button>
    <h3 class="form-title" style="margin-top:16px">${isEdit ? 'Edit' : 'New'} Client</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="cf-name" value="${esc(c.name)}" placeholder="Channel name">
      </div>
      <div class="form-group">
        <label class="form-label">Tag</label>
        <input class="form-input" id="cf-tag" value="${esc(c.tag)}" placeholder="YouTube">
      </div>
      <div class="form-group">
        <label class="form-label">Subscribers</label>
        <input class="form-input" id="cf-subs" value="${esc(c.subscribers)}" placeholder="24M">
      </div>
      <div class="form-group">
        <label class="form-label">Initials (fallback)</label>
        <input class="form-input" id="cf-initials" value="${esc(c.initials)}" placeholder="BA">
      </div>
      <div class="form-group">
        <label class="form-label">Sort Order</label>
        <input class="form-input" type="number" id="cf-sort" value="${c.sort_order || 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Avatar</label>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="cell-avatar" id="cf-avatar-preview">
            ${c.avatar_url ? `<img src="${c.avatar_url}" alt="">` : (c.initials || '?')}
          </div>
          <label class="btn btn-outline btn-small" style="cursor:pointer">
            Upload
            <input type="file" accept="image/*" style="display:none" onchange="uploadClientAvatar(this)">
          </label>
        </div>
        <input type="hidden" id="cf-avatar-url" value="${c.avatar_url || ''}">
      </div>
      <div class="form-group full">
        <label class="form-label">Channel URL</label>
        <input class="form-input" id="cf-url" value="${esc(c.url)}" placeholder="https://www.youtube.com/@channel">
      </div>
      <div class="form-group full">
        <label class="form-label">Description</label>
        <input class="form-input" id="cf-desc" value="${esc(c.description)}" placeholder="3D Art & Creative Content">
      </div>
    </div>
    <div style="margin-top:24px;display:flex;gap:12px">
      <button class="btn btn-primary" onclick="saveClient(${isEdit ? c.id : 'null'})">${isEdit ? 'Save Changes' : 'Create Client'}</button>
      <button class="btn btn-outline" onclick="hideClientForm()">Cancel</button>
    </div>
  `;
}

async function uploadClientAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const result = await uploadFile(file);
    document.getElementById('cf-avatar-url').value = result.url;
    document.getElementById('cf-avatar-preview').innerHTML = `<img src="${result.url}" alt="">`;
    showStatus('Avatar uploaded.');
  } catch {
    showStatus('Upload failed.', 'error');
  }
}

async function saveClient(id) {
  const data = {
    name: document.getElementById('cf-name').value,
    description: document.getElementById('cf-desc').value,
    tag: document.getElementById('cf-tag').value,
    subscribers: document.getElementById('cf-subs').value,
    avatar_url: document.getElementById('cf-avatar-url').value,
    initials: document.getElementById('cf-initials').value,
    url: document.getElementById('cf-url').value,
    sort_order: +document.getElementById('cf-sort').value || 0
  };

  if (!data.name) { showStatus('Name is required.', 'error'); return; }

  const url = id ? `/api/admin/clients/${id}` : '/api/admin/clients';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  if (res.ok) {
    showStatus(id ? 'Client updated.' : 'Client created.');
    hideClientForm();
    await loadAll();
  } else {
    showStatus('Failed to save.', 'error');
  }
}

function editClient(id) {
  const c = clients.find(x => x.id === id);
  if (c) showClientForm(c);
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  const res = await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
  if (res.ok) { showStatus('Client deleted.'); await loadAll(); }
}

function hideClientForm() {
  document.getElementById('clientForm').style.display = 'none';
  document.getElementById('clientsList').style.display = '';
}

// ===== TIKTOK PANEL (dashboard) =====
function toggleDashTtPanel() {
  const panel = document.getElementById('pf-tt-panel');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; panel.innerHTML = ''; return; }

  panel.style.display = '';
  panel.innerHTML = `
    <div style="margin-top:12px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--r)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <svg viewBox="0 0 48 48" width="16" height="16" fill="currentColor"><path d="M38.4 21.7V16c-3.1 0-5.5-1-7.2-2.9-1.6-1.9-2.4-4.3-2.4-7.1h-5.7v23.5c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.6 0 1.1.1 1.6.3V18.5c-.5-.1-1.1-.1-1.6-.1-6.2 0-11.2 5-11.2 11.2S11.5 40.8 17.7 40.8s11.2-5 11.2-11.2V19.8c2.4 1.7 5.3 2.7 8.5 2.7v-0.8z"/></svg>
        <span style="font-size:13px;font-weight:600">Add TikTok Video</span>
      </div>
      <input class="form-input" id="pf-tt-url" placeholder="https://tiktok.com/@user/video/123..." style="width:100%;margin-bottom:8px">
      <div id="pf-tt-preview" style="margin-bottom:8px"></div>
      <div style="margin-bottom:10px">
        <label class="form-label" style="margin-bottom:4px">Custom thumbnail (optional)</label>
        <label class="btn btn-outline btn-small" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload
          <input type="file" accept="image/*,video/*" style="display:none" onchange="dashTtThumbUpload(this)">
        </label>
        <div id="pf-tt-thumb-preview" style="margin-top:6px"></div>
        <input type="hidden" id="pf-tt-thumb-url" value="">
      </div>
      <button class="btn btn-primary btn-small" onclick="confirmDashTt()">Add Video</button>
      <button class="btn btn-outline btn-small" onclick="document.getElementById('pf-tt-panel').style.display='none'">Cancel</button>
    </div>
  `;

  const inp = document.getElementById('pf-tt-url');
  inp.addEventListener('input', async () => {
    const prev = document.getElementById('pf-tt-preview');
    const id = getTTId(inp.value);
    if (id) {
      try {
        const res = await fetch('/api/tiktok/oembed?url=' + encodeURIComponent(inp.value));
        const data = await res.json();
        if (data.thumbnail_url) {
          prev.innerHTML = `<img src="${data.thumbnail_url}" style="width:100%;border-radius:8px;max-width:200px">`;
          document.getElementById('pf-tt-thumb-url').value = data.thumbnail_url;
        }
      } catch { prev.innerHTML = '<span style="color:var(--dim);font-size:12px">Could not load preview</span>'; }
    } else { prev.innerHTML = ''; }
  });

  setTimeout(() => inp.focus(), 50);
}

async function dashTtThumbUpload(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const result = await uploadFile(file);
    document.getElementById('pf-tt-thumb-url').value = result.url;
    const prev = document.getElementById('pf-tt-thumb-preview');
    if (file.type.startsWith('video')) {
      prev.innerHTML = `<video src="${result.url}" muted autoplay loop style="width:100%;max-width:200px;border-radius:8px"></video>`;
    } else {
      prev.innerHTML = `<img src="${result.url}" style="width:100%;max-width:200px;border-radius:8px">`;
    }
    showStatus('Thumbnail uploaded.');
  } catch { showStatus('Upload failed.', 'error'); }
}

function confirmDashTt() {
  const url = document.getElementById('pf-tt-url').value.trim();
  if (!url) return;
  const ttId = getTTId(url);
  if (!ttId) { showStatus('Invalid TikTok URL', 'error'); return; }

  const thumbUrl = document.getElementById('pf-tt-thumb-url')?.value || '';

  const m = { type: 'tiktok', src: url };
  if (thumbUrl) m.thumb = thumbUrl;

  const item = document.createElement('div');
  item.className = 'media-item';
  item.dataset.src = url;
  item.dataset.type = 'tiktok';
  if (thumbUrl) item.dataset.thumb = thumbUrl;

  const thumbPreview = thumbUrl
    ? `<img src="${thumbUrl}" alt="">`
    : `<div style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 48 48" width="20" height="20" fill="#fff"><path d="M38.4 21.7V16c-3.1 0-5.5-1-7.2-2.9-1.6-1.9-2.4-4.3-2.4-7.1h-5.7v23.5c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.6 0 1.1.1 1.6.3V18.5c-.5-.1-1.1-.1-1.6-.1-6.2 0-11.2 5-11.2 11.2S11.5 40.8 17.7 40.8s11.2-5 11.2-11.2V19.8c2.4 1.7 5.3 2.7 8.5 2.7v-0.8z"/></svg></div>`;
  item.innerHTML = `${thumbPreview}<div style="position:absolute;top:3px;left:3px;background:#000;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px">TT</div><button class="media-item-remove" onclick="this.parentElement.remove()">&times;</button>`;

  const addBtn = document.getElementById('pf-media-add');
  addBtn.parentElement.insertBefore(item, addBtn);

  document.getElementById('pf-tt-panel').style.display = 'none';
  document.getElementById('pf-tt-panel').innerHTML = '';
  showStatus('TikTok video added.');
}

// ===== UTILS =====
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
