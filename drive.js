// Conexión con Google Drive: el navegador habla directo con Drive usando la cuenta Gmail de quien entra.
// Alcance "drive.file": Croni solo ve los archivos que él mismo crea. No hay base de datos propia.
(function () {
  const C = window.CRONI_CONFIG;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  let token = null, tokenExp = 0, client = null, fileId = null, folderId = null, lastVersion = null;

  let pending = null;
  function ready() {
    return new Promise(res => {
      if (window.google && google.accounts) return res();
      window.addEventListener('gsi', () => res(), { once: true });
    });
  }
  // El cliente se prepara al cargar la página: así la ventana de Google se abre en el mismo
  // instante del toque (los celulares la bloquean si hay una espera de por medio).
  function initClient() {
    if (client || !C.GOOGLE_CLIENT_ID) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: C.GOOGLE_CLIENT_ID, scope: SCOPE,
      callback: r => {
        const p = pending; pending = null; if (!p) return;
        if (r.error) return p.reject(new Error(r.error_description || r.error));
        token = r.access_token; tokenExp = Date.now() + (r.expires_in - 60) * 1000; p.resolve(token);
      },
      error_callback: e => { const p = pending; pending = null; if (p) p.reject(new Error(e.type === 'popup_failed_to_open' ? 'el navegador bloqueó la ventana de Google; permite las ventanas emergentes' : (e.type || 'cancelado'))); }
    });
  }
  ready().then(initClient);
  function getToken(prompt) {
    if (!client) { if (window.google && google.accounts) initClient(); else return Promise.reject(new Error('Google aún está cargando, intenta de nuevo en unos segundos')); }
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
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
    const r = await (await call(`${API}/files?q=${q(query)}&fields=files(id,name,version,modifiedTime)&spaces=drive&orderBy=${q('modifiedTime desc')}`)).json();
    return r.files[0]; // si hubiera duplicados, gana el modificado más recientemente
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
  // La versión que devuelve la subida no siempre coincide con la que luego informa Drive (causaba falsos "conflictos"),
  // así que después de guardar se vuelve a leer la versión real.
  async function curVersion() { return (await (await call(`${API}/files/${fileId}?fields=version`)).json()).version; }
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
        fileId = r.id; lastVersion = await curVersion(); return r;
      }
      if (!force) {
        const m = await (await call(`${API}/files/${fileId}?fields=version`)).json();
        if (m.version !== lastVersion) { const e = new Error('conflict'); e.conflict = true; throw e; }
      }
      const r = await multipart({}, data, 'PATCH', fileId);
      lastVersion = await curVersion(); return r;
    },
    // Compartir: apoya los permisos en los permisos de Drive (editor = writer, solo lectura = reader).
    async share(email, role) {
      if (!fileId) throw new Error('Primero guarda los datos en Drive');
      await call(`${API}/files/${fileId}/permissions?sendNotificationEmail=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role: role === 'reader' ? 'reader' : 'writer', emailAddress: email }) });
    },
    // Pide de nuevo el permiso (incluye Calendar). Debe llamarse directo desde un toque del usuario.
    reauth() { return getToken('consent'); },
    connect() { return getToken(''); },
    known: () => !!fileId,
    // Google Calendar: cada actividad es un evento con su aviso previo; el celular avisa con la app cerrada.
    // Crear con un id fijo por actividad: si por cualquier motivo se intenta crear dos veces, Calendar rechaza la
    // copia (409) y en vez de duplicar se actualiza el evento que ya existía.
    async calUpsert(id, ev) {
      try { return await (await call(CAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ev, id }) })).json(); }
      catch (e) {
        if (!/ 409/.test(e.message)) throw e;
        try { return await (await call(`${CAL}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ev, status: 'confirmed' }) })).json(); }
        catch (e2) { // si ese evento fue borrado a mano y no se puede reactivar, se crea con otro id
          const alt = id + 'r' + Math.random().toString(32).slice(2, 8);
          return (await call(CAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ev, id: alt }) })).json();
        }
      }
    },
    async calList(q, timeMin) {
      const r = await (await call(`${CAL}?q=${encodeURIComponent(q)}&timeMin=${encodeURIComponent(timeMin)}&maxResults=250&singleEvents=true&orderBy=startTime`)).json();
      return r.items || [];
    },
    async calPatch(id, ev) {
      try { return await (await call(`${CAL}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) })).json(); }
      catch (e) { if (/ 404| 410/.test(e.message)) return null; throw e; }
    },
    async calDelete(id) {
      try { await call(`${CAL}/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
      catch (e) { if (!/ 404| 410/.test(e.message)) throw e; }
    },
    async openShared(id) { fileId = id; const data = await (await call(`${API}/files/${id}?alt=media`)).json(); return data; }
  };
})();
