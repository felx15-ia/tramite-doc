// ============================================================
//  GESTOR DOCUMENTARIO — VISTA PÚBLICA (SOLO LECTURA)
// ============================================================
import { getTramites } from './supabase.js';

let searchQuery  = '';
let estadoFilter = '';
let autoRefreshTimer;

function diasEnGestion(fechaStr) {
  const hoy    = new Date(); hoy.setHours(0,0,0,0);
  const inicio = new Date(fechaStr + 'T00:00:00');
  return Math.max(0, Math.floor((hoy - inicio) / 86400000));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function badgeEstado(estado) {
  const map = {
    'Recibido':  ['badge-recibido',  '📥'],
    'En Firma':  ['badge-en-firma',  '✍️'],
    'Derivado':  ['badge-derivado',  '↗️'],
    'Archivado': ['badge-archivado', '🗄️'],
  };
  const [cls, icon] = map[estado] || ['badge-archivado', '?'];
  return `<span class="badge ${cls}">${icon} ${estado}</span>`;
}

function badgePrioridad(p) {
  const map  = { Alta: 'badge-alta', Media: 'badge-media', Baja: 'badge-baja' };
  const icon = { Alta: '🔴', Media: '🟡', Baja: '🟢' };
  return `<span class="badge ${map[p] || ''}">${icon[p] || ''} ${p}</span>`;
}

function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null;
  const hoy    = new Date(); hoy.setHours(0,0,0,0);
  const limite = new Date(fechaLimite + 'T00:00:00');
  return Math.floor((limite - hoy) / 86400000);
}

function renderFechaLimite(fechaLimite, estado) {
  if (!fechaLimite || estado === 'Archivado')
    return '<span style="color:var(--text-muted);font-size:12px">Sin plazo</span>';
  const dias  = diasRestantes(fechaLimite);
  const fecha = formatDate(fechaLimite);
  if (dias < 0)  return `<div class="plazo-badge plazo-vencido"><span>⏰ VENCIDO</span><small>${fecha}</small><small style="font-weight:700">${Math.abs(dias)}d atrás</small></div>`;
  if (dias === 0) return `<div class="plazo-badge plazo-hoy"><span>🚨 VENCE HOY</span><small>${fecha}</small></div>`;
  if (dias <= 3)  return `<div class="plazo-badge plazo-proximo"><span>⚠️ ${dias} día${dias!==1?'s':''}</span><small>${fecha}</small></div>`;
  return `<div class="plazo-badge plazo-ok"><span>✅ ${dias} días</span><small>${fecha}</small></div>`;
}

function rowAlertClass(dias, estado, fechaLimite) {
  if (fechaLimite && estado !== 'Archivado') {
    const dr = diasRestantes(fechaLimite);
    if (dr !== null && dr < 0)  return 'row-danger';
    if (dr !== null && dr <= 3) return 'row-warning';
  }
  if (estado !== 'Recibido') return '';
  if (dias > 5) return 'row-danger';
  if (dias > 3) return 'row-warning';
  return '';
}

async function loadData() {
  const tableBody   = document.getElementById('table-body-ro');
  const recordCount = document.getElementById('record-count-ro');
  const lastUpdate  = document.getElementById('last-update');

  tableBody.innerHTML = `
    <tr><td colspan="9">
      <div class="loading-overlay"><div class="spinner"></div><span>Cargando...</span></div>
    </td></tr>`;

  try {
    const list = await getTramites(searchQuery, estadoFilter);
    recordCount.textContent = `${list.length} registro${list.length !== 1 ? 's' : ''}`;
    lastUpdate.textContent  = new Date().toLocaleTimeString('es-PE');

    if (!list.length) {
      tableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No hay trámites</div></div></td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(t => {
      const dias   = diasEnGestion(t.fecha_recepcion);
      const rowCls = rowAlertClass(dias, t.estado, t.fecha_limite);
      const dCls   = t.estado !== 'Recibido' ? 'dias-normal' : dias > 5 ? 'dias-danger' : dias > 3 ? 'dias-warning' : 'dias-normal';
      return `
        <tr class="${rowCls}">
          <td><strong style="color:var(--cyan-dark)">${t.nro_registro}</strong></td>
          <td><span class="badge badge-tipo">${t.tipo}</span></td>
          <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.remitente}">${t.remitente}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.asunto}">${t.asunto}</td>
          <td>${badgePrioridad(t.prioridad)}</td>
          <td style="white-space:nowrap">${formatDate(t.fecha_recepcion)}</td>
          <td>${badgeEstado(t.estado)}</td>
          <td class="${dCls}" style="text-align:center;font-weight:600">${dias}d ${dias > 3 && t.estado === 'Recibido' ? (dias > 5 ? '🔴' : '🟠') : ''}</td>
          <td style="min-width:120px">${renderFechaLimite(t.fecha_limite, t.estado)}</td>
        </tr>`;
    }).join('');
  } catch(e) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#dc2626;padding:32px">Error: ${e.message}</td></tr>`;
  }
}


// Búsqueda
let searchTimeout;
document.getElementById('search-input-ro').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim();
    loadData();
  }, 350);
});

document.getElementById('filter-estado-ro').addEventListener('change', e => {
  estadoFilter = e.target.value;
  loadData();
});

// Auto-refresh cada 60 segundos
function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(loadData, 60000);

  let countdown = 60;
  const countEl = document.getElementById('refresh-countdown');
  setInterval(() => {
    countdown--;
    if (countdown <= 0) countdown = 60;
    if (countEl) countEl.textContent = countdown;
  }, 1000);
}

// Actualización manual
document.getElementById('btn-refresh').addEventListener('click', () => {
  loadData();
  startAutoRefresh();
});

// Reloj
function updateClock() {
  const opts = { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' };
  const el = document.getElementById('live-clock-ro');
  if (el) el.textContent = new Date().toLocaleString('es-PE', opts);
}
updateClock();
setInterval(updateClock, 1000);

// Init
loadData();
startAutoRefresh();
