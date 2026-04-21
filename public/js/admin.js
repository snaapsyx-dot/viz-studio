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
  document.getElementById('tab-settings').style.display = tab === 'settings' ? '' : 'none';
  if (tab === 'settings') loadSettings();
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

// ========================
// PROJECTS
// ========================
function renderProjectsTable() {
  const el = document.getElementById('projectsList');
  if (!projects.length) {
    el.innerHTML = '<div class="empty-state">No projects yet. Click "+ Add Project" to create one.</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Name</th><th>Category</th><th>Year</th><th>Media</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${projects.map(p => `
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

function showProjectForm(project = null) {
  const form = document.getElementById('projectForm');
  const list = document.getElementById('projectsList');
  list.style.display = 'none';
  form.style.display = '';

  const p = project || { name: '', category: '', year: '', description: '', role: '', duration: '', tags: [], media: [], sort_order: 0 };
  const isEdit = !!project;

  form.innerHTML = `
    <button class="btn-back" onclick="hideProjectForm()">&larr; Back to list</button>
    <h3 class="form-title" style="margin-top:16px">${isEdit ? 'Edit' : 'New'} Project</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="pf-name" value="${esc(p.name)}" placeholder="Project name">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <input class="form-input" id="pf-category" value="${esc(p.category)}" placeholder="YouTube · 3D Animation">
      </div>
      <div class="form-group">
        <label class="form-label">Year</label>
        <input class="form-input" id="pf-year" value="${esc(p.year)}" placeholder="2026">
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <input class="form-input" id="pf-role" value="${esc(p.role)}" placeholder="3D Artist">
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
      <div class="form-group full">
        <label class="form-label">Tags (press Enter to add)</label>
        <div class="tags-input-wrap" id="pf-tags-wrap">
          ${(p.tags || []).map(t => `<span class="tag-chip">${esc(t)} <button onclick="this.parentElement.remove()">&times;</button></span>`).join('')}
          <input class="tags-input" id="pf-tags-input" placeholder="Add tag...">
        </div>
      </div>
      <div class="form-group full">
        <label class="form-label">Media</label>
        <div class="media-list" id="pf-media">
          ${(p.media || []).map((m, i) => mediaItemHTML(m, i)).join('')}
          <label class="media-add" id="pf-media-add">
            +
            <input type="file" accept="image/*,video/*" style="display:none" onchange="addProjectMedia(this)">
          </label>
        </div>
      </div>
    </div>
    <div style="margin-top:24px;display:flex;gap:12px">
      <button class="btn btn-primary" onclick="saveProject(${isEdit ? p.id : 'null'})">${isEdit ? 'Save Changes' : 'Create Project'}</button>
      <button class="btn btn-outline" onclick="hideProjectForm()">Cancel</button>
    </div>
  `;

  // Tags input handler
  document.getElementById('pf-tags-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const tag = e.target.value.trim();
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${esc(tag)} <button onclick="this.parentElement.remove()">&times;</button>`;
      e.target.parentElement.insertBefore(chip, e.target);
      e.target.value = '';
    }
  });
}

let projectMediaList = [];

function mediaItemHTML(m, idx) {
  const isVideo = m.type === 'video';
  return `
    <div class="media-item" data-src="${esc(m.src)}" data-type="${m.type}">
      ${isVideo ? `<video src="${m.src}" muted></video>` : `<img src="${m.src}" alt="">`}
      <button class="media-item-remove" onclick="this.parentElement.remove()">&times;</button>
    </div>
  `;
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

function getProjectFormData() {
  const tags = [...document.querySelectorAll('#pf-tags-wrap .tag-chip')].map(c => c.textContent.replace('×', '').trim());
  const media = [...document.querySelectorAll('#pf-media .media-item')].map(el => ({
    type: el.dataset.type,
    src: el.dataset.src
  }));

  return {
    name: document.getElementById('pf-name').value,
    category: document.getElementById('pf-category').value,
    year: document.getElementById('pf-year').value,
    description: document.getElementById('pf-desc').value,
    role: document.getElementById('pf-role').value,
    duration: document.getElementById('pf-duration').value,
    sort_order: +document.getElementById('pf-sort').value || 0,
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

// ========================
// SETTINGS
// ========================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings/showreel_url');
    const { value } = await res.json();
    const input = document.getElementById('showreel-url');
    if (input) input.value = value || '';
    updateShowreelPreview(value);
  } catch {}
}

function updateShowreelPreview(url) {
  const preview = document.getElementById('showreel-preview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<video src="${url}" controls muted style="width:100%;display:block;"></video>`;
  } else {
    preview.innerHTML = '<div style="padding:24px;text-align:center;color:var(--dim);">No video set</div>';
  }
}

async function uploadShowreel(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const result = await uploadFile(file);
    document.getElementById('showreel-url').value = result.url;
    updateShowreelPreview(result.url);
    showStatus('Video uploaded. Click Save to apply.');
  } catch {
    showStatus('Upload failed.', 'error');
  }
}

async function saveShowreel() {
  const url = document.getElementById('showreel-url').value.trim();
  const res = await fetch('/api/admin/settings/showreel_url', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: url })
  });
  if (res.ok) {
    showStatus('Showreel updated!');
    updateShowreelPreview(url);
  } else {
    showStatus('Failed to save.', 'error');
  }
}

// ===== UTILS =====
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
