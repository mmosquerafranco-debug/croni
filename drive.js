// Conexión con Google Drive: el navegador habla directo con Drive usando la cuenta Gmail de quien entra.
// Alcance "drive.file": Croni solo ve los archivos que él mismo crea. No hay base de datos propia.
(function () {
  const C = window.CRONI_CONFIG;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  let token = null, tokenExp = 0, client = null, fileId = null, folderId = null, lastVersion = null;

  function ready() {
    return new Promise(res => {
      if (window.google && google.accounts) return res();
      window.addEventListener('gsi', () => res(), { once: true });
    });
  }
  function getToken(prompt) {
    return new Promise(async (resolve, reject) => {
      await ready();
      if (!client) {
        client = google.accounts.oauth2.initTokenClient({
          client_id: C.GOOGLE_CLIENT_ID, scope: SCOPE,
          callback: r => { if (r.error) return reject(new Error(r.error)); token = r.access_token; tokenExp = Date.now() + (r.expires_in - 60) * 1000; resolve(token); },
          error_callback: e => reject(new Error(e.type || 'cancelado'))
        });
      }
      client.requestAccessToken({ prompt: prompt || '' });
    });
  }
  async function auth() { if (token && Date.now() < tokenExp) return token; return getToken(''); }
  async function call(url, opt = {}) {
    await auth();
    const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt.headers || {}) } });
    if (r.status === 401) { token = null; await auth(); return call(url, opt); }
    if (!r.ok) throw new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }
  const q = s => encodeURIComponent(s);
  async function findOne(query) {
    const r = await (await call(`${API}/files?q=${q(query)}&fields=files(id,name,version,modifiedTime)&spaces=drive`)).json();
    return r.files[0];
  }
  async function ensureFolder() {
    if (folderId) return folderId;
    const f = await findOne(`name='${C.DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    if (f) return (folderId = f.id);
    const r = await (await call(`${API}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: C.DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }) })).json();
    return (folderId = r.id);
  }
  async function multipart(meta, body, method, id) {
    const b = '----croni' + Date.now();
    const data = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(body)}\r\n--${b}--`;
    const url = id ? `${UP}/files/${id}?uploadType=multipart&fields=id,version` : `${UP}/files?uploadType=multipart&fields=id,version`;
    return (await call(url, { method, headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: data })).json();
  }
  window.CroniDrive = {
    configured: () => !!C.GOOGLE_CLIENT_ID,
    async signIn() {
      await getToken('select_account');
      const u = await (await call('https://www.googleapis.com/oauth2/v3/userinfo')).json();
      return { email: u.email, name: u.name || u.email };
    },
    signOut() { if (token && window.google) google.accounts.oauth2.revoke(token, () => {}); token = null; fileId = null; folderId = null; },
    // Devuelve {data, version} o null si es la primera vez
    async load() {
      const fid = await ensureFolder();
      const f = await findOne(`name='${C.DATA_FILE}' and '${fid}' in parents and trashed=false`);
      if (!f) return null;
      fileId = f.id;
      const data = await (await call(`${API}/files/${f.id}?alt=media`)).json();
      lastVersion = f.version;
      return { data, version: f.version };
    },
    // Detecta ediciones simultáneas: si la versión en Drive cambió, avisa en vez de pisar.
    async save(data, force) {
      const fid = await ensureFolder();
      if (!fileId) {
        const r = await multipart({ name: C.DATA_FILE, parents: [fid], mimeType: 'application/json' }, data, 'POST');
        fileId = r.id; lastVersion = r.version; return r;
      }
      if (!force) {
        const m = await (await call(`${API}/files/${fileId}?fields=version`)).json();
        if (m.version !== lastVersion) { const e = new Error('conflict'); e.conflict = true; throw e; }
      }
      const r = await multipart({}, data, 'PATCH', fileId);
      lastVersion = r.version; return r;
    },
    // Compartir: apoya los permisos en los permisos de Drive (editor = writer, solo lectura = reader).
    async share(email, role) {
      if (!fileId) throw new Error('Primero guarda los datos en Drive');
      await call(`${API}/files/${fileId}/permissions?sendNotificationEmail=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role: role === 'reader' ? 'reader' : 'writer', emailAddress: email }) });
    },
    async openShared(id) { fileId = id; const data = await (await call(`${API}/files/${id}?alt=media`)).json(); return data; }
  };
})();
