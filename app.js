(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const QCOL = { hacer: '#9ED88E', programar: '#F7D981', delegar: '#F7D981', eliminar: '#F9A0AE' };
const QNAME = { programar: 'Programar', hacer: 'Hacer', eliminar: 'Eliminar', delegar: 'Delegar' };
const ST = ['todo', 'doing', 'done'], SL = { todo: 'Por hacer', doing: 'En curso', done: 'Hecho' };
const LEADS = { '10 min': 10, '1 hora': 60, '1 día': 1440 };
const PALETTE = ['#F781D8', '#B4A4F9', '#F7D981', '#9ED88E', '#7FC8F8', '#FF9F6B'];
const TABS = [['hoy', 'Hoy'], ['crono', 'Cronograma'], ['cal', 'Calendario'], ['kanban', 'Tablero'], ['matriz', 'Matriz'], ['notas', 'Notas'], ['insights', 'Insights'], ['share', 'Compartir']];

// ---------- fechas (todas como 'YYYY-MM-DD') ----------
const pad = n => String(n).padStart(2, '0');
const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => toISO(new Date());
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const lbl = iso => { const d = parse(iso); return d.getDate() + '/' + (d.getMonth() + 1); };
const longDate = iso => { const d = parse(iso); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nowStamp = () => { const d = new Date(); return toISO(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

// ---------- estado ----------
const LS = 'croni.v1';
let S = { tab: 'hoy', biz: null, calMode: 'Mes', calAnchor: today(), digestWeek: false, openQ: null, user: null, mode: null, sync: 'local', dirty: false };
let D = null; // datos del usuario
let saveTimer = null;

function demo() {
  const t = today(), a = n => addDays(t, n);
  return {
    v: 1, nid: 20,
    bizs: [{ id: 'a', name: 'Café Luna', color: '#F781D8' }, { id: 'b', name: 'Estudio Brisa', color: '#B4A4F9' }, { id: 'c', name: 'Tienda Sol', color: '#F7D981' }],
    acts: [
      { id: 1, title: 'Pagar proveedores', biz: 'a', s: a(-2), e: a(-2), time: '09:00', q: 'hacer', st: 'todo', lead: '1 día', rep: 'Mensual', tags: ['pagos'], subs: [] },
      { id: 2, title: 'Reunión con cliente', biz: 'b', s: a(0), e: a(0), time: '10:30', q: 'hacer', st: 'doing', lead: '1 hora', rep: 'No', tags: [], subs: [] },
      { id: 3, title: 'Inventario semanal', biz: 'c', s: a(0), e: a(1), time: '10:30', q: 'programar', st: 'todo', lead: '1 día', rep: 'Semanal', tags: [], subs: [{ t: 'Contar estantes', d: true }, { t: 'Actualizar planilla', d: false }] },
      { id: 4, title: 'Enviar cotización', biz: 'a', s: a(0), e: a(0), time: '16:00', q: 'delegar', st: 'done', lead: '10 min', rep: 'No', tags: [], subs: [] },
      { id: 5, title: 'Campaña de redes', biz: 'b', s: a(1), e: a(5), time: '09:00', q: 'programar', st: 'doing', lead: '1 día', rep: 'No', tags: ['marketing'], subs: [] },
      { id: 6, title: 'Renovar permiso municipal', biz: 'c', s: a(3), e: a(3), time: '12:00', q: 'hacer', st: 'todo', lead: '1 día', rep: 'No', tags: [], subs: [] },
      { id: 7, title: 'Rediseñar menú', biz: 'a', s: a(4), e: a(9), time: '11:00', q: 'programar', st: 'todo', lead: '1 día', rep: 'No', tags: [], subs: [] },
      { id: 8, title: 'Revisar redes viejas', biz: 'b', s: a(2), e: a(2), time: '15:00', q: 'eliminar', st: 'todo', lead: '1 hora', rep: 'No', tags: [], subs: [] },
      { id: 9, title: 'Cierre de caja', biz: 'c', s: a(6), e: a(6), time: '18:00', q: 'delegar', st: 'todo', lead: '1 hora', rep: 'Diaria', tags: [], subs: [] }
    ],
    notes: [{ id: 1, text: 'Idea: combo desayuno + cowork' }, { id: 2, text: 'Preguntar precio del nuevo proveedor' }],
    people: [], log: [], done: [], snooze: {}
  };
}
const blank = () => ({ v: 1, nid: 1, bizs: [], acts: [], notes: [], people: [], log: [], done: [], snooze: {} });

function localLoad() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
function localSave() { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) {} }

// ---------- persistencia + sincronización con Drive ----------
function setSync(s) { S.sync = s; paintSync(); }
function paintSync() {
  const m = { local: ['#aaa', 'Solo en este dispositivo'], ok: ['#3fbf5f', 'Sincronizado con Drive'], pending: ['#F7B500', 'Pendiente de sincronizar'], saving: ['#F7B500', 'Guardando…'], offline: ['#F7B500', 'Sin conexión · se sincroniza al volver'], conflict: ['#e0386b', 'Conflicto: otra persona editó'], err: ['#e0386b', 'Error al sincronizar'] }[S.sync];
  $('#syncDot').style.background = m[0]; $('#syncText').textContent = m[1];
}
function commit(logMsg) {
  if (logMsg && S.mode === 'drive') D.log.unshift(nowStamp() + ' · ' + (S.user ? S.user.name : 'Tú') + ' ' + logMsg);
  else if (logMsg) D.log.unshift(nowStamp() + ' · ' + logMsg);
  D.log = D.log.slice(0, 200);
  D.updated = new Date().toISOString();
  localSave(); S.dirty = true;
  if (S.mode === 'drive') { setSync(navigator.onLine ? 'pending' : 'offline'); clearTimeout(saveTimer); saveTimer = setTimeout(push, 1500); }
  render();
}
async function push(force) {
  if (S.mode !== 'drive' || !S.dirty) return;
  if (!navigator.onLine) return setSync('offline');
  try {
    setSync('saving'); await CroniDrive.save(D, force === true); S.dirty = false; setSync('ok');
  } catch (e) {
    if (e.conflict) { setSync('conflict'); showConflict(); } else { setSync('err'); toast('No se pudo guardar en Drive. Se reintentará.'); setTimeout(push, 15000); }
  }
}
function showConflict() {
  modal(`<h3 class="display">Alguien más editó estos datos</h3>
  <p class="small muted">Para no perder trabajo, elige qué versión conservar. Esta acción no se hace sola.</p>
  <button class="btn primary" data-do="useRemote">Cargar la versión de Drive (descarto mis cambios nuevos)</button>
  <button class="btn outline" data-do="useMine">Conservar la mía y sobrescribir Drive</button>`);
}
window.addEventListener('online', () => { if (S.mode === 'drive' && S.dirty) push(); else paintSync(); });
window.addEventListener('offline', () => { if (S.mode === 'drive') setSync('offline'); });

// ---------- lógica de actividades ----------
const biz = id => D.bizs.find(b => b.id === id) || { name: '—', color: '#ccc' };
function status(a) {
  if (a.st === 'done') return 'done';
  const t = today();
  if (a.e < t) return 'late';
  if (diff(a.e, t) <= 1) return 'risk';
  return 'ok';
}
const BADGE = { done: ['Hecha', '#DDD6FB'], late: ['Vencida', '#F9A0AE'], risk: ['En riesgo', '#F7D981'], ok: ['A tiempo', '#E4F6DF'] };
const visible = () => D.acts.filter(a => !S.biz || a.biz === S.biz).sort((x, y) => x.s.localeCompare(y.s) || x.time.localeCompare(y.time));
function setStatus(id, st) {
  const a = D.acts.find(x => x.id === id); if (!a) return;
  const was = a.st; a.st = st;
  if (st === 'done' && was !== 'done') {
    D.done.push({ id, biz: a.biz, at: today() });
    const step = { Diaria: 1, Semanal: 7, Mensual: 30 }[a.rep];
    if (step) { const len = diff(a.e, a.s); const s = addDays(a.s, step); D.acts.push({ ...a, id: D.nid++, s, e: addDays(s, len), st: 'todo', subs: (a.subs || []).map(x => ({ t: x.t, d: false })) }); }
  }
  commit('movió “' + a.title + '” a ' + SL[st]);
}
function conflicts() {
  const t = today(), by = {};
  D.acts.filter(a => a.s <= t && a.e >= t && a.st !== 'done' && (!S.biz || a.biz === S.biz)).forEach(a => (by[a.time] = by[a.time] || []).push(a));
  return Object.keys(by).filter(k => by[k].length > 1 && new Set(by[k].map(x => x.biz)).size > 1).map(k => '⚠ Conflicto a las ' + k + ': ' + by[k].map(x => biz(x.biz).name).join(' y '));
}
function searchMatch(a) {
  const q = (S.q || '').toLowerCase().trim(); if (!q) return true;
  return (a.title + ' ' + (a.obs || '') + ' ' + (a.tags || []).join(' ') + ' ' + biz(a.biz).name + ' ' + (a.owner || '')).toLowerCase().includes(q);
}

// ---------- vistas ----------
const V = {};
function actRow(a) {
  const b = BADGE[status(a)], c = biz(a.biz).color, done = a.st === 'done';
  return `<div class="row" style="border-left-color:${c}" data-edit="${a.id}">
    <button class="check ${done ? 'on' : ''}" data-toggle="${a.id}" aria-label="Marcar">${done ? '✓' : ''}</button>
    <div class="grow"><b style="${done ? 'text-decoration:line-through' : ''}">${esc(a.title)}</b>
    <small>${esc(biz(a.biz).name)} · ${a.time} · 🔔 ${a.lead} antes${a.rep !== 'No' ? ' · ↻ ' + a.rep : ''}</small>
    ${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <span class="badge" style="background:${b[1]}">${b[0]}</span></div>`;
}
V.hoy = () => {
  const t = today(), acts = visible().filter(searchMatch);
  const items = acts.filter(a => (a.s <= t && a.e >= t) || (a.e < t && a.st !== 'done'));
  const cf = conflicts();
  const upcoming = acts.filter(a => a.st !== 'done' && a.e >= t).slice(0, 4);
  const range = S.digestWeek ? [t, addDays(t, 6)] : [t, t];
  const dg = acts.filter(a => a.s <= range[1] && a.e >= range[0]);
  const dgText = biz => '';
  const per = D.bizs.map(b => { const l = dg.filter(a => a.biz === b.id); return l.length ? `${b.name}: ${l.length} (${l.filter(a => a.st === 'done').length} hechas)` : ''; }).filter(Boolean).join(' · ') || 'Sin actividades en este periodo.';
  return `<div class="grid"><section class="card">
    <div><div class="display h1">Hoy</div><div class="small muted">${cap(longDate(t))} · ${items.length} actividades de ${S.biz ? 'este negocio' : 'todos tus negocios'}</div></div>
    ${cf.map(c => `<div class="banner">${esc(c)}</div>`).join('')}
    <div class="stack">${items.map(actRow).join('') || '<div class="muted" style="text-align:center;padding:20px">Nada para hoy. ¡Disfruta!</div>'}</div></section>
    <section class="stack" style="gap:20px">
      <div class="card pink" style="gap:8px"><b class="small">Alertas próximas</b>
        ${upcoming.map(a => `<div style="background:#fff;border-radius:14px;padding:10px 14px;font-size:13px;display:flex;justify-content:space-between;gap:10px"><b>${esc(a.title)}</b><span class="muted">${a.s <= t ? 'Hoy' : lbl(a.s)} · ${a.time}</span><button class="btn small" data-snooze="${a.id}" title="Posponer 1 hora">⏰</button></div>`).join('') || '<span class="small">Sin alertas.</span>'}
        <button class="btn small outline" id="btnNotif" style="align-self:flex-start">Activar avisos del navegador</button></div>
      <div class="card lil" style="flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div><div class="display" style="font-size:22px">Resumen ${S.digestWeek ? 'semanal' : 'diario'}</div><div class="small" style="margin-top:4px">${esc(per)}</div></div>
        <button class="btn small" data-do="digest">Ver ${S.digestWeek ? 'diario' : 'semanal'}</button></div>
    </section></div>`;
};
V.crono = () => {
  const t = today(), days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
  const rows = visible().filter(searchMatch).filter(a => a.e >= t && a.s < addDays(t, 14));
  return `<section class="card"><div class="display h1">Cronograma</div><div class="scroll-x"><div class="gantt">
    <div class="g-head">${days.map(d => { const w = parse(d).getDay(); return `<div style="${d === t ? 'background:rgba(247,129,216,.25);border-radius:8px;font-weight:700' : w % 6 === 0 ? 'background:rgba(180,164,249,.15)' : ''}">${WD[(w + 6) % 7]}<br><b>${parse(d).getDate()}</b></div>`; }).join('')}</div>
    <div class="g-grid">${days.map(() => '<div></div>').join('')}</div>
    <div class="g-rows">${rows.map(a => { const s = Math.max(0, diff(a.s, t)), e = Math.min(13, diff(a.e, t)), n = e - s + 1; return `<div class="g-row"><button class="g-bar" data-edit="${a.id}" style="left:${s / 14 * 100}%;width:${n / 14 * 100}%;background:${biz(a.biz).color}"><span>${esc(a.title)}</span><span>${n}d</span></button></div>`; }).join('') || '<div class="muted">Sin actividades en las próximas 2 semanas.</div>'}</div></div></div></section>`;
};
V.cal = () => {
  const m = S.calMode, an = parse(S.calAnchor), acts = visible().filter(searchMatch);
  let start, n, title;
  if (m === 'Mes') { const f = new Date(an.getFullYear(), an.getMonth(), 1); start = addDays(toISO(f), -((f.getDay() + 6) % 7)); n = 42; title = cap(MESES[an.getMonth()]) + ' ' + an.getFullYear(); }
  else if (m === 'Semana') { start = addDays(S.calAnchor, -((an.getDay() + 6) % 7)); n = 7; title = 'Semana del ' + lbl(start); }
  else { start = S.calAnchor; n = 1; title = cap(longDate(start)); }
  const cells = Array.from({ length: n }, (_, i) => addDays(start, i)), t = today();
  const head = m === 'Día' ? '' : WD.map((w, i) => `<div class="cal-h" style="background:${i > 4 ? '#F7D981' : '#FFD6F3'}">${w}</div>`).join('');
  return `<section class="card"><div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center">
    <div class="display h1" style="font-size:30px">${esc(title)}</div>
    <div class="inline"><button class="btn small" data-cal="-1">‹</button><button class="btn small" data-cal="0">Hoy</button><button class="btn small" data-cal="1">›</button></div></div>
    <div class="seg">${['Día', 'Semana', 'Mes'].map(x => `<button class="${m === x ? 'on' : ''}" data-calmode="${x}">${x}</button>`).join('')}</div>
    <div class="cal ${m === 'Día' ? 'day' : ''}">${head}${cells.map(d => { const inM = m !== 'Mes' || parse(d).getMonth() === an.getMonth(); return `<div class="cal-c" style="background:${d === t ? '#FFD6F3' : inM ? '#F6F3FB' : '#FAF8FD'};${d === t ? 'outline:2px solid #F781D8' : ''};color:${inM ? '#111' : '#aaa'}" data-newday="${d}"><span class="n">${parse(d).getDate()}</span>${acts.filter(a => a.s <= d && a.e >= d).map(a => `<button class="ev" data-edit="${a.id}" style="background:${biz(a.biz).color}">${m === 'Mes' ? '' : a.time + ' '}${esc(a.title)}</button>`).join('')}</div>`; }).join('')}</div></section>`;
};
V.kanban = () => {
  const acts = visible().filter(searchMatch);
  return `<div class="kan">${ST.map((st, i) => `<section class="kcol" style="background:${['#F6F3FB', '#DDD6FB', '#FFD6F3'][i]}"><b>${SL[st]} · ${acts.filter(a => a.st === st).length}</b>
    ${acts.filter(a => a.st === st).map(a => `<div class="kcard" style="border-left-color:${biz(a.biz).color}"><b data-edit="${a.id}" style="cursor:pointer">${esc(a.title)}</b><small class="muted">${esc(biz(a.biz).name)} · ${lbl(a.s)}${(a.subs || []).length ? ' · ' + a.subs.filter(x => x.d).length + '/' + a.subs.length + ' subtareas' : ''}</small>
    <div class="acts"><button data-move="${a.id}|${ST[Math.max(0, i - 1)]}" aria-label="Atrás">←</button><button data-move="${a.id}|${ST[Math.min(2, i + 1)]}" aria-label="Adelante">→</button></div></div>`).join('')}</section>`).join('')}</div>`;
};
V.matriz = () => {
  const acts = visible().filter(searchMatch).filter(a => a.st !== 'done');
  const qs = ['programar', 'hacer', 'eliminar', 'delegar'], open = S.openQ;
  const box = q => { const l = acts.filter(a => a.q === q), isOpen = open === q; return `<div class="mq ${isOpen ? 'open' : ''}" style="background:${QCOL[q]}" ${isOpen ? '' : `data-q="${q}" role="button" tabindex="0"`}>
    <div class="t">${QNAME[q]} <span class="small">(${l.length})</span>${isOpen ? ' <button class="btn small" data-q="close" style="float:right">Cerrar</button>' : ''}</div>
    ${isOpen ? l.map(a => `<button class="mini" data-edit="${a.id}" style="border-left-color:${biz(a.biz).color}">${esc(a.title)} · ${lbl(a.s)}</button>`).join('') || '<span class="small">Vacío</span>' : l.slice(0, 3).map(a => `<div class="mini" style="border-left-color:${biz(a.biz).color}">${esc(a.title)}</div>`).join('')}</div>`; };
  const list = open ? [open, ...qs.filter(x => x !== open)] : qs;
  return `<section class="card"><div class="display h1">Matriz</div><div class="axis"><span>← No urgente</span><span>Urgente →</span></div>
    <div class="mx">${list.map(box).join('')}</div><div class="axis"><span>↑ Importante arriba · ↓ Poco importante abajo</span></div></section>`;
};
V.notas = () => `<section class="card"><div class="display h1">Notas</div>
  <div class="inline"><input class="inp" id="noteIn" placeholder="Captura rápida…" maxlength="300"><button class="btn primary" data-do="addNote">Guardar</button></div>
  <div class="stack">${D.notes.map(n => `<div class="row"><div class="grow">${esc(n.text)}</div><button class="btn small primary" data-note2task="${n.id}">→ Tarea</button><button class="btn small" data-delnote="${n.id}">✕</button></div>`).join('') || '<div class="muted">Sin notas.</div>'}</div></section>`;
V.insights = () => {
  const acts = D.acts.filter(a => !S.biz || a.biz === S.biz), t = today();
  const late = acts.filter(a => status(a) === 'late').length, done = acts.filter(a => a.st === 'done').length;
  const pct = acts.length ? Math.round(done / acts.length * 100) : 0;
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(t, i); return { d, n: acts.filter(a => a.s <= d && a.e >= d && a.st !== 'done').length }; });
  const mx = Math.max(1, ...week.map(w => w.n));
  const hours = b => D.acts.filter(a => a.biz === b && a.st !== 'done').reduce((s, a) => s + (diff(a.e, a.s) + 1), 0);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = addDays(t, i - 6); return D.done.filter(x => x.at === d && (!S.biz || x.biz === S.biz)).length; });
  const m7 = Math.max(1, ...last7);
  return `<section class="card"><div class="display h1">Insights</div>
  <div class="stats"><div class="stat"><b>${late}</b>Vencidas</div><div class="stat"><b>${pct}%</b>Cumplimiento</div><div class="stat"><b>${acts.filter(a => a.st !== 'done').length}</b>Pendientes</div></div>
  <b>Cumplimiento por negocio</b>${D.bizs.map(b => { const l = D.acts.filter(a => a.biz === b.id), p = l.length ? Math.round(l.filter(a => a.st === 'done').length / l.length * 100) : 0; return `<div><div class="small">${esc(b.name)} · ${p}%</div><div class="bar"><i style="width:${p}%;background:${b.color}"></i></div></div>`; }).join('')}
  <b>Carga de los próximos 7 días</b><div class="spark">${week.map(w => `<div style="height:${w.n / mx * 100}%" title="${w.n}"></div>`).join('')}</div><div class="small muted" style="display:flex;justify-content:space-between">${week.map(w => `<span>${WD[(parse(w.d).getDay() + 6) % 7]}</span>`).join('')}</div>
  <b>Días de trabajo pendiente por negocio</b>${D.bizs.map(b => `<div class="small">${esc(b.name)}: ${hours(b.id)} días-actividad</div>`).join('')}
  <b>Tendencia: hechas en los últimos 7 días</b><div class="spark">${last7.map(n => `<div style="height:${n / m7 * 100}%;background:#9ED88E" title="${n}"></div>`).join('')}</div></section>`;
};
V.share = () => `<div class="grid"><section class="card"><div class="display h1">Compartir</div>
  <p class="small muted">${S.mode === 'drive' ? 'Se comparte el archivo de datos de tu Drive. Los permisos son los de Drive; la persona recibe un correo.' : 'Para compartir, entra con tu cuenta de Gmail (así se apoya en los permisos de Drive).'}</p>
  <div class="inline"><input class="inp" id="invMail" type="email" placeholder="correo@gmail.com"><select class="inp" id="invRole" style="width:auto"><option value="writer">Editor</option><option value="reader">Solo lectura</option></select></div>
  <button class="btn primary" data-do="invite" style="align-self:flex-start">Invitar</button><div class="err" id="invErr"></div>
  <div class="stack">${D.people.map(p => `<div class="row"><div class="grow"><b>${esc(p.mail)}</b><small>${p.role === 'reader' ? 'Solo lectura' : 'Editor'}</small></div></div>`).join('') || '<div class="muted small">Aún no has invitado a nadie.</div>'}</div></section>
  <section class="card pink"><b>Bitácora (quién hizo qué)</b><div class="stack small">${D.log.slice(0, 15).map(l => `<div>${esc(l)}</div>`).join('') || 'Sin movimientos aún.'}</div></section></div>`;

// ---------- render ----------
function render() {
  if (!D) return;
  $('#bizBar').innerHTML = `<button class="chip" data-biz="" style="background:${!S.biz ? '#111' : '#fff'};color:${!S.biz ? '#fff' : '#111'}">Todos los negocios</button>` +
    D.bizs.map(b => `<button class="chip" data-biz="${b.id}" style="border-color:${b.color};background:${S.biz === b.id ? b.color : '#fff'}"><i style="background:${b.color}"></i>${esc(b.name)}</button>`).join('') +
    `<button class="chip" data-do="newBiz" style="border-style:dashed">+ Negocio</button>` +
    `<input class="inp" id="search" placeholder="Buscar…" value="${esc(S.q || '')}" style="max-width:200px;border-radius:999px;margin-left:auto">`;
  $('#tabs').innerHTML = TABS.map(t => `<button class="tab ${S.tab === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('');
  const v = $('#view'), f = document.activeElement && document.activeElement.id === 'search';
  v.innerHTML = D.bizs.length || S.tab === 'share' ? V[S.tab]() : `<section class="card"><div class="display h1">¡Bienvenida!</div><p>Crea tu primer negocio para empezar.</p><button class="btn primary" data-do="newBiz" style="align-self:flex-start">+ Negocio</button></section>`;
  if (f) { const i = $('#search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  paintSync();
}

// ---------- modales ----------
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 3500); }
let FORM = null;
function openForm(a, day) {
  if (!D.bizs.length) return toast('Primero crea un negocio.');
  const d = day || today();
  FORM = a ? JSON.parse(JSON.stringify(a)) : { id: null, title: '', biz: S.biz || D.bizs[0].id, s: d, e: d, time: '09:00', q: 'programar', st: 'todo', lead: '1 día', rep: 'No', tags: [], subs: [], obs: '', owner: '' };
  paintForm('');
}
function paintForm(err) {
  const f = FORM, opt = (list, cur) => list.map(x => `<option ${x === cur ? 'selected' : ''}>${x}</option>`).join('');
  modal(`<h3 class="display" style="margin:0;font-size:26px">${f.id ? 'Editar' : 'Nueva'} actividad</h3>
  <label>Título<input id="f_title" value="${esc(f.title)}" maxlength="120"></label>
  <div class="two"><label>Negocio<select id="f_biz">${D.bizs.map(b => `<option value="${b.id}" ${b.id === f.biz ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
  <label>Hora<input id="f_time" type="time" value="${f.time}"></label></div>
  <div class="two"><label>Desde<input id="f_s" type="date" value="${f.s}"></label><label>Hasta<input id="f_e" type="date" value="${f.e}"></label></div>
  <div class="two"><label>Aviso previo<select id="f_lead">${opt(Object.keys(LEADS), f.lead)}</select></label><label>Repetir<select id="f_rep">${opt(['No', 'Diaria', 'Semanal', 'Mensual'], f.rep)}</select></label></div>
  <div class="two"><label>Cuadrante<select id="f_q">${Object.keys(QNAME).map(k => `<option value="${k}" ${k === f.q ? 'selected' : ''}>${QNAME[k]}</option>`).join('')}</select></label><label>Responsable<input id="f_owner" value="${esc(f.owner || '')}" placeholder="correo o nombre"></label></div>
  <label>Etiquetas (separadas por coma)<input id="f_tags" value="${esc((f.tags || []).join(', '))}"></label>
  <label>Observaciones<textarea id="f_obs" rows="2">${esc(f.obs || '')}</textarea></label>
  <div><b class="small">Subtareas</b>${(f.subs || []).map((s, i) => `<div class="inline" style="margin-top:6px"><input type="checkbox" data-sub="${i}" ${s.d ? 'checked' : ''}><span style="flex:1;font-size:13px">${esc(s.t)}</span><button class="btn small" data-do="delSub" data-i="${i}">✕</button></div>`).join('')}
  <div class="inline" style="margin-top:6px"><input class="inp" id="f_sub" placeholder="Nueva subtarea"><button class="btn small" data-do="addSub">+</button></div></div>
  <div class="err">${esc(err)}</div>
  <div class="inline" style="justify-content:space-between;flex-wrap:wrap">${f.id ? '<button class="btn danger" data-do="delAct">Eliminar</button>' : '<span></span>'}<span class="inline"><button class="btn" data-do="close">Cancelar</button><button class="btn primary" data-do="saveAct">Guardar</button></span></div>`);
}
function readForm() {
  const g = id => $('#' + id).value, f = FORM;
  Object.assign(f, { title: g('f_title').trim(), biz: g('f_biz'), time: g('f_time') || '09:00', s: g('f_s'), e: g('f_e'), lead: g('f_lead'), rep: g('f_rep'), q: g('f_q'), owner: g('f_owner').trim(), obs: g('f_obs'), tags: g('f_tags').split(',').map(x => x.trim()).filter(Boolean) });
  document.querySelectorAll('[data-sub]').forEach(c => f.subs[+c.dataset.sub].d = c.checked);
}

// ---------- acciones ----------
async function doAction(el) {
  const a = el.dataset.do;
  if (a === 'close') return closeModal();
  if (a === 'digest') { S.digestWeek = !S.digestWeek; return render(); }
  if (a === 'addSub') { readForm(); const v = $('#f_sub').value.trim(); if (v) FORM.subs.push({ t: v, d: false }); return paintForm(''); }
  if (a === 'delSub') { readForm(); FORM.subs.splice(+el.dataset.i, 1); return paintForm(''); }
  if (a === 'saveAct') {
    readForm(); const f = FORM;
    if (!f.title) return paintForm('Escribe un título.');
    if (!f.s || !f.e) return paintForm('Elige las fechas.');
    if (f.e < f.s) return paintForm('La fecha final no puede ser anterior.');
    if (f.id) D.acts = D.acts.map(x => x.id === f.id ? f : x); else { f.id = D.nid++; D.acts.push(f); }
    closeModal(); return commit((FORM.id ? 'guardó' : 'creó') + ' “' + f.title + '”');
  }
  if (a === 'delAct') { if (!confirm('¿Eliminar esta actividad? No se puede deshacer.')) return; D.acts = D.acts.filter(x => x.id !== FORM.id); closeModal(); return commit('eliminó “' + FORM.title + '”'); }
  if (a === 'addNote') { const v = $('#noteIn').value.trim(); if (!v) return; D.notes.unshift({ id: D.nid++, text: v }); return commit('añadió una nota'); }
  if (a === 'newBiz') {
    return modal(`<h3 class="display" style="margin:0">Nuevo negocio</h3><label>Nombre<input id="b_name" maxlength="40"></label>
    <div class="inline">${PALETTE.map((c, i) => `<label style="flex-direction:row;align-items:center;gap:4px"><input type="radio" name="b_col" value="${c}" ${i === D.bizs.length % PALETTE.length ? 'checked' : ''}><span style="width:22px;height:22px;border-radius:50%;background:${c};display:inline-block"></span></label>`).join('')}</div>
    <div class="inline"><button class="btn" data-do="close">Cancelar</button><button class="btn primary" data-do="saveBiz">Crear</button></div>`);
  }
  if (a === 'saveBiz') { const n = $('#b_name').value.trim(); if (!n) return; const c = document.querySelector('[name=b_col]:checked').value; D.bizs.push({ id: 'b' + D.nid++, name: n, color: c }); closeModal(); return commit('creó el negocio “' + n + '”'); }
  if (a === 'invite') {
    const mail = $('#invMail').value.trim().toLowerCase(), role = $('#invRole').value, err = $('#invErr');
    if (!/^[^\s@]+@gmail\.com$/.test(mail)) return err.textContent = 'Usa un correo Gmail válido.';
    if (S.mode !== 'drive') return err.textContent = 'Entra con Gmail para compartir.';
    if (!confirm('¿Compartir tu archivo de Croni con ' + mail + ' como ' + (role === 'reader' ? 'solo lectura' : 'editor') + '?')) return;
    try { await push(true); await CroniDrive.share(mail, role); D.people.push({ mail, role }); commit('invitó a ' + mail); toast('Invitación enviada'); } catch (e) { err.textContent = 'No se pudo compartir: ' + e.message; }
  }
  if (a === 'useRemote') { const r = await CroniDrive.load(); if (r) { D = r.data; localSave(); S.dirty = false; setSync('ok'); } closeModal(); render(); }
  if (a === 'useMine') { closeModal(); S.dirty = true; push(true); }
  if (a === 'logout') { closeModal(); CroniDrive.signOut(); localStorage.removeItem(LS); location.reload(); }
  if (a === 'exportJson') { const b = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }), u = document.createElement('a'); u.href = URL.createObjectURL(b); u.download = 'croni-respaldo-' + today() + '.json'; u.click(); }
  if (a === 'exportCsv') { const rows = [['Título', 'Negocio', 'Desde', 'Hasta', 'Hora', 'Estado', 'Cuadrante']].concat(D.acts.map(x => [x.title, biz(x.biz).name, x.s, x.e, x.time, SL[x.st], QNAME[x.q]])); const b = new Blob(['﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }), u = document.createElement('a'); u.href = URL.createObjectURL(b); u.download = 'croni-' + today() + '.csv'; u.click(); }
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-toggle],[data-edit],[data-do],[data-biz],[data-tab],[data-move],[data-q],[data-calmode],[data-cal],[data-note2task],[data-delnote],[data-snooze],[data-newday],#btnNew,#btnUser,#btnExport,#btnNotif');
  if (!t) return;
  const d = t.dataset;
  if (d.toggle) { e.stopPropagation(); const a = D.acts.find(x => x.id === +d.toggle); return setStatus(a.id, a.st === 'done' ? 'todo' : 'done'); }
  if (d.edit) return openForm(D.acts.find(x => x.id === +d.edit));
  if (d.do) return doAction(t);
  if (d.biz !== undefined) { S.biz = d.biz || null; return render(); }
  if (d.tab) { S.tab = d.tab; return render(); }
  if (d.move) { const [id, st] = d.move.split('|'); return setStatus(+id, st); }
  if (d.q) { S.openQ = d.q === 'close' ? null : d.q; return render(); }
  if (d.calmode) { S.calMode = d.calmode; return render(); }
  if (d.cal !== undefined) { const n = +d.cal, an = S.calAnchor; S.calAnchor = n === 0 ? today() : S.calMode === 'Mes' ? toISO(new Date(parse(an).getFullYear(), parse(an).getMonth() + n, 1)) : addDays(an, n * (S.calMode === 'Semana' ? 7 : 1)); return render(); }
  if (d.note2task) { const n = D.notes.find(x => x.id === +d.note2task); D.notes = D.notes.filter(x => x !== n); const day = today(); D.acts.push({ id: D.nid++, title: n.text.slice(0, 120), biz: S.biz || D.bizs[0].id, s: day, e: day, time: '09:00', q: 'programar', st: 'todo', lead: '1 día', rep: 'No', tags: [], subs: [], obs: '' }); return commit('convirtió una nota en tarea'); }
  if (d.delnote) { D.notes = D.notes.filter(x => x.id !== +d.delnote); return commit('borró una nota'); }
  if (d.snooze) { D.snooze[d.snooze] = Date.now() + 3600e3; localSave(); return toast('Alerta pospuesta 1 hora'); }
  if (d.newday) { if (e.target.closest('.ev')) return; return openForm(null, d.newday); }
  if (t.id === 'btnNew') return openForm(null);
  if (t.id === 'btnNotif') return enableNotif();
  if (t.id === 'btnExport') return modal('<h3 class="display" style="margin:0">Exportar y respaldar</h3><button class="btn primary" data-do="exportJson">Respaldo completo (JSON)</button><button class="btn outline" data-do="exportCsv">Actividades (CSV/Excel)</button><button class="btn" data-do="close">Cerrar</button>');
  if (t.id === 'btnUser') return modal(`<h3 class="display" style="margin:0">${esc(S.user ? S.user.name : 'Modo local')}</h3><p class="small muted">${S.user ? esc(S.user.email) : 'Tus datos están solo en este dispositivo.'}</p><button class="btn outline" id="btnExport2" data-do="exportJson">Exportar respaldo</button><button class="btn danger" data-do="logout">Cerrar sesión</button><button class="btn" data-do="close">Cerrar</button>`);
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('input', e => { if (e.target.id === 'search') { S.q = e.target.value; render(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); if (e.key === 'Enter' && e.target.id === 'noteIn') doAction({ dataset: { do: 'addNote' } }); });

// ---------- notificaciones (mientras la app está abierta o instalada) ----------
async function enableNotif() {
  if (!('Notification' in window)) return toast('Este navegador no soporta avisos.');
  const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Avisos activados' : 'Avisos no permitidos');
}
const fired = new Set();
function checkAlerts() {
  if (!D || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  D.acts.forEach(a => {
    if (a.st === 'done') return;
    const at = new Date(a.s + 'T' + a.time).getTime(), fireAt = at - LEADS[a.lead] * 60000, key = a.id + '|' + a.s;
    if (now >= fireAt && now < at + 3600e3 && !fired.has(key) && !(D.snooze[a.id] > now)) {
      fired.add(key); new Notification('Croni · ' + biz(a.biz).name, { body: a.title + ' a las ' + a.time, icon: 'icon.svg' });
    }
  });
}
setInterval(checkAlerts, 30000);

// ---------- arranque ----------
async function enter(mode, user) {
  S.mode = mode; S.user = user || null;
  $('#login').hidden = true; $('#app').hidden = false;
  if (user) $('#btnUser').textContent = (user.name || 'M').charAt(0).toUpperCase();
  render(); checkAlerts();
}
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const saved = localStorage.getItem(LS + '.session');
  if (saved === 'demo') { D = localLoad() || demo(); return enter('local'); }
  $('#login').hidden = false;
  if (!CroniDrive.configured()) $('#loginMsg').textContent = 'Falta configurar el ID de cliente de Google (ver LEEME.md). Mientras tanto puedes probar en modo local.';
  const cached = localLoad(); if (saved === 'drive' && cached) { D = cached; S.user = JSON.parse(localStorage.getItem(LS + '.user') || 'null'); enter('drive', S.user); setSync(navigator.onLine ? 'pending' : 'offline'); S.dirty = false; reconnect(); }
}
async function reconnect() {
  if (!navigator.onLine) return setSync('offline');
  try {
    const r = await CroniDrive.load();
    if (r && !S.dirty) { D = r.data; localSave(); render(); }
    setSync('ok');
    if (S.dirty) push();
  } catch (e) { setSync('pending'); }
}
$('#btnDemo').onclick = () => { localStorage.setItem(LS + '.session', 'demo'); D = localLoad() || demo(); localSave(); enter('local'); };
$('#btnLogin').onclick = async () => {
  if (!CroniDrive.configured()) return $('#loginMsg').textContent = 'Falta configurar GOOGLE_CLIENT_ID en config.js (ver LEEME.md).';
  try {
    $('#loginMsg').textContent = 'Conectando con Google…';
    const u = await CroniDrive.signIn(); const r = await CroniDrive.load();
    D = r ? r.data : (localLoad() || blank());
    localStorage.setItem(LS + '.session', 'drive'); localStorage.setItem(LS + '.user', JSON.stringify(u));
    enter('drive', u); localSave();
    if (!r) { S.dirty = true; push(); } else setSync('ok');
  } catch (e) { $('#loginMsg').textContent = 'No se pudo entrar: ' + e.message; }
};
boot();
})();
