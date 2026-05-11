// ============================================================
//  GESTOR DOCUMENTARIO — LÓGICA PRINCIPAL (APP.JS)
// ============================================================
import { getTramites, createTramite, updateEstado, deleteTramite, existeRegistro, updateTramite } from './supabase.js';

// ── Estado global ────────────────────────────────────────────
let allTramites  = [];
let searchQuery  = '';
let estadoFilter = '';
let deleteTarget = null;
let editMode     = false;
let editId       = null;

// ── Autenticación ───────────────────────────────────────────
const PASS_CORRECTA = 'secre2026';
const loginForm      = document.getElementById('login-form');
const loginError     = document.getElementById('login-error');

function checkAuth() {
  if (sessionStorage.getItem('admin_auth') === 'true') {
    document.body.classList.add('authenticated');
    loadTramites();
  }
}

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const pass = document.getElementById('admin-pass').value;
  if (pass === PASS_CORRECTA) {
    sessionStorage.setItem('admin_auth', 'true');
    document.body.classList.add('authenticated');
    showToast('Acceso concedido');
    loadTramites();
  } else {
    loginError.style.display = 'block';
    setTimeout(() => { loginError.style.display = 'none'; }, 3000);
  }
});

// ── DOM refs ─────────────────────────────────────────────────
const form         = document.getElementById('form-tramite');
const tableBody    = document.getElementById('table-body');
const searchInput  = document.getElementById('search-input');
const filterEstado = document.getElementById('filter-estado');
const recordCount  = document.getElementById('record-count');
const deleteModal  = document.getElementById('delete-modal');
const deleteMsgEl  = document.getElementById('delete-msg');
const confirmDel   = document.getElementById('confirm-delete');
const cancelDel    = document.getElementById('cancel-delete');
const btnCancelEdit = document.getElementById('btn-cancelar-edit');
const btnLimpiar   = document.getElementById('btn-limpiar');

// ── Utilidades de fecha ──────────────────────────────────────
function diasEnGestion(fechaStr) {
  const hoy    = new Date(); hoy.setHours(0,0,0,0);
  const inicio = new Date(fechaStr + 'T00:00:00');
  return Math.max(0, Math.floor((hoy - inicio) / 86400000));
}

/** Días restantes hasta la fecha límite (negativo = vencido) */
function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null;
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const limite = new Date(fechaLimite + 'T00:00:00');
  return Math.floor((limite - hoy) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Badges ───────────────────────────────────────────────────
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
  const map  = { Alta:'badge-alta', Media:'badge-media', Baja:'badge-baja' };
  const icon = { Alta:'🔴', Media:'🟡', Baja:'🟢' };
  return `<span class="badge ${map[p]||''}">${icon[p]||''} ${p}</span>`;
}

/** Renderiza la celda de Fecha Límite con colores según urgencia */
function renderFechaLimite(fechaLimite, estado) {
  if (!fechaLimite || estado === 'Archivado') {
    return '<span style="color:var(--text-muted);font-size:12px">Sin plazo</span>';
  }
  const dias = diasRestantes(fechaLimite);
  const fecha = formatDate(fechaLimite);

  if (dias < 0) {
    // Vencido
    return `<div class="plazo-badge plazo-vencido">
      <span>⏰ VENCIDO</span>
      <small>${fecha}</small>
      <small style="font-weight:700">${Math.abs(dias)} día${Math.abs(dias)!==1?'s':''} atrás</small>
    </div>`;
  } else if (dias === 0) {
    return `<div class="plazo-badge plazo-hoy">
      <span>🚨 VENCE HOY</span>
      <small>${fecha}</small>
    </div>`;
  } else if (dias <= 3) {
    return `<div class="plazo-badge plazo-proximo">
      <span>⚠️ ${dias} día${dias!==1?'s':''}</span>
      <small>${fecha}</small>
    </div>`;
  } else {
    return `<div class="plazo-badge plazo-ok">
      <span>✅ ${dias} días</span>
      <small>${fecha}</small>
    </div>`;
  }
}

function rowAlertClass(dias, estado, fechaLimite) {
  // Prioridad: plazo vencido > plazo por vencer > gestión lenta
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

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const icon = type === 'success' ? '✅' : '❌';
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  document.querySelector('.toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── KPIs ─────────────────────────────────────────────────────
function updateKPIs(list) {
  const hoy      = new Date(); hoy.setHours(0,0,0,0);
  const total    = list.length;
  const recibido = list.filter(t => t.estado === 'Recibido').length;
  const firma    = list.filter(t => t.estado === 'En Firma').length;
  const alerta   = list.filter(t => t.estado === 'Recibido' && diasEnGestion(t.fecha_recepcion) > 3).length;
  const vencidos = list.filter(t => {
    if (!t.fecha_limite || t.estado === 'Archivado') return false;
    return diasRestantes(t.fecha_limite) < 0;
  }).length;

  animateCount(document.getElementById('kpi-total'),    total);
  animateCount(document.getElementById('kpi-recibido'), recibido);
  animateCount(document.getElementById('kpi-firma'),    firma);
  animateCount(document.getElementById('kpi-alerta'),   alerta);
  animateCount(document.getElementById('kpi-vencidos'), vencidos);
}

function animateCount(el, target) {
  if (!el) return;
  let current = 0;
  const step  = Math.max(1, Math.floor(target / 20));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

// ── Render tabla ─────────────────────────────────────────────
function renderTable(list) {
  recordCount.textContent = `${list.length} registro${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    tableBody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">No se encontraron trámites</div>
        </div>
      </td></tr>`;
    return;
  }

  tableBody.innerHTML = list.map(t => {
    const dias   = diasEnGestion(t.fecha_recepcion);
    const rowCls = rowAlertClass(dias, t.estado, t.fecha_limite);
    const dCls   = t.estado !== 'Recibido' ? 'dias-normal'
                 : dias > 5 ? 'dias-danger'
                 : dias > 3 ? 'dias-warning'
                 : 'dias-normal';

    const estados = ['Recibido','En Firma','Derivado','Archivado'];
    const btnsEstado = estados.map(e => {
      const cls = { 'Recibido':'recibido','En Firma':'firma','Derivado':'derivado','Archivado':'archivado' }[e];
      const active = t.estado === e ? 'active' : '';
      return `<button class="btn-estado ${cls} ${active}"
        data-id="${t.id}" data-estado="${e}"
        ${t.estado === e ? 'disabled' : ''}>${e}</button>`;
    }).join('');

    return `
      <tr class="${rowCls}" data-id="${t.id}">
        <td><strong style="color:var(--cyan-dark)">${t.nro_registro}</strong></td>
        <td><span class="badge badge-tipo">${t.tipo}</span></td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.remitente}">${t.remitente}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.derivado_a || ''}">${t.derivado_a || '—'}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.asunto}">${t.asunto}</td>
        <td>${badgePrioridad(t.prioridad)}</td>
        <td style="white-space:nowrap">${formatDate(t.fecha_recepcion)}</td>
        <td>${badgeEstado(t.estado)}</td>
        <td class="${dCls}" style="text-align:center;font-weight:600;white-space:nowrap">
          ${dias}d ${dias > 3 && t.estado === 'Recibido' ? (dias > 5 ? '🔴' : '🟠') : ''}
        </td>
        <td style="min-width:120px">${renderFechaLimite(t.fecha_limite, t.estado)}</td>
        <td>
          <div class="status-actions">
            ${btnsEstado}
            <button class="btn btn-ghost btn-sm btn-edit"
              data-id="${t.id}" title="Editar Datos">✏️</button>
            <button class="btn btn-danger btn-sm btn-delete"
              data-id="${t.id}" data-nro="${t.nro_registro}" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Cargar datos ──────────────────────────────────────────────
async function loadTramites() {
  tableBody.innerHTML = `
    <tr><td colspan="10">
      <div class="loading-overlay">
        <div class="spinner"></div><span>Cargando registros...</span>
      </div>
    </td></tr>`;
  try {
    allTramites = await getTramites(searchQuery, estadoFilter);
    renderTable(allTramites);
    updateKPIs(allTramites);
  } catch(e) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#dc2626;padding:32px">Error: ${e.message}</td></tr>`;
    showToast('Error al conectar con la base de datos', 'error');
  }
}

// ── Form submit ───────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = form.querySelector('#btn-guardar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  const fechaLimiteVal = form['fecha-limite'].value;
  const payload = {
    nro_registro:    form['nro-registro'].value.trim(),
    tipo:            form['tipo'].value,
    remitente:       form['remitente'].value.trim(),
    derivado_a:      form['derivado-a'].value.trim() || null,
    asunto:          form['asunto'].value.trim(),
    prioridad:       form['prioridad'].value,
    fecha_recepcion: form['fecha-recepcion'].value,
    fecha_limite:    fechaLimiteVal || null,
    observaciones:   form['observaciones'].value.trim() || null,
    estado:          'Recibido',
  };

  try {
    if (editMode) {
      await updateTramite(editId, payload);
      showToast(`Trámite ${payload.nro_registro} actualizado`);
      cancelEdit();
    } else {
      const dup = await existeRegistro(payload.nro_registro);
      if (dup) {
        showToast(`N° "${payload.nro_registro}" ya existe`, 'error');
        btn.disabled = false; btn.innerHTML = '💾 Registrar Documento';
        return;
      }
      await createTramite(payload);
      showToast(`Trámite ${payload.nro_registro} registrado`);
      form.reset();
      document.getElementById('fecha-recepcion').valueAsDate = new Date();
    }
    await loadTramites();
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = editMode ? '💾 Actualizar Datos' : '💾 Registrar Documento';
  }
});

// ── Búsqueda con debounce ─────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { searchQuery = searchInput.value.trim(); loadTramites(); }, 350);
});
filterEstado.addEventListener('change', () => { estadoFilter = filterEstado.value; loadTramites(); });

// ── Eventos de tabla ──────────────────────────────────────────
tableBody.addEventListener('click', async e => {
  const btnEstado = e.target.closest('.btn-estado');
  if (btnEstado && !btnEstado.disabled) {
    const { id, estado } = btnEstado.dataset;
    btnEstado.disabled = true;
    try {
      await updateEstado(id, estado);
      showToast(`Estado → "${estado}"`);
      await loadTramites();
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      btnEstado.disabled = false;
    }
  }
  
  const btnEdit = e.target.closest('.btn-edit');
  if (btnEdit) {
    const id = btnEdit.dataset.id;
    const item = allTramites.find(t => t.id === id);
    if (item) startEdit(item);
  }

  const btnDel = e.target.closest('.btn-delete');
  if (btnDel) {
    deleteTarget = btnDel.dataset.id;
    deleteMsgEl.textContent = `¿Eliminar trámite N° ${btnDel.dataset.nro}? Esta acción no se puede deshacer.`;
    deleteModal.classList.add('open');
  }
});

// ── Funciones de Edición ─────────────────────────────────────
function startEdit(t) {
  editMode = true;
  editId   = t.id;
  
  // Poblar formulario
  form['nro-registro'].value = t.nro_registro;
  form['tipo'].value         = t.tipo;
  form['remitente'].value    = t.remitente;
  form['derivado-a'].value   = t.derivado_a || '';
  form['asunto'].value       = t.asunto;
  form['prioridad'].value    = t.prioridad;
  form['fecha-recepcion'].value = t.fecha_recepcion;
  form['fecha-limite'].value    = t.fecha_limite || '';
  form['observaciones'].value   = t.observaciones || '';
  
  // UI
  document.getElementById('btn-guardar').innerHTML = '💾 Actualizar Datos';
  btnCancelEdit.style.display = 'inline-block';
  btnLimpiar.style.display    = 'none';
  
  // Scroll al formulario
  window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
}

function cancelEdit() {
  editMode = false;
  editId   = null;
  form.reset();
  document.getElementById('fecha-recepcion').valueAsDate = new Date();
  document.getElementById('btn-guardar').innerHTML = '💾 Registrar Documento';
  btnCancelEdit.style.display = 'none';
  btnLimpiar.style.display    = 'inline-block';
}

btnCancelEdit.addEventListener('click', cancelEdit);

// ── Modal borrado ─────────────────────────────────────────────
confirmDel.addEventListener('click', async () => {
  if (!deleteTarget) return;
  confirmDel.disabled = true;
  try {
    await deleteTramite(deleteTarget);
    showToast('Trámite eliminado');
    await loadTramites();
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    deleteModal.classList.remove('open');
    deleteTarget = null;
    confirmDel.disabled = false;
  }
});
cancelDel.addEventListener('click', () => { deleteModal.classList.remove('open'); deleteTarget = null; });
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.classList.remove('open'); deleteTarget = null; }});

// ── Reloj ─────────────────────────────────────────────────────
function updateClock() {
  const opts = { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' };
  document.getElementById('live-clock').textContent = new Date().toLocaleString('es-PE', opts);
}
updateClock(); setInterval(updateClock, 1000);

// ── Exportar a PDF ────────────────────────────────────────────
const btnExportPdf = document.getElementById('btn-export-pdf');
if (btnExportPdf) {
  btnExportPdf.addEventListener('click', () => {
    if (!allTramites || allTramites.length === 0) {
      showToast('No hay datos para exportar', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    doc.text('Reporte de Trámites Documentarios', 14, 15);
    
    const tableData = allTramites.map(t => [
      t.nro_registro,
      t.tipo,
      t.remitente,
      t.derivado_a || '—',
      t.asunto,
      t.prioridad,
      formatDate(t.fecha_recepcion),
      t.estado,
      formatDate(t.fecha_limite)
    ]);
    
    doc.autoTable({
      startY: 20,
      head: [['N° Registro', 'Tipo', 'Origen', 'Destino', 'Asunto', 'Prioridad', 'F. Recepción', 'Estado', 'F. Límite']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] }
    });
    
    doc.save('reporte_tramites.pdf');
    showToast('PDF exportado correctamente');
  });
}

// ── Exportar a Excel ──────────────────────────────────────────
const btnExportExcel = document.getElementById('btn-export-excel');
if (btnExportExcel) {
  btnExportExcel.addEventListener('click', () => {
    if (!allTramites || allTramites.length === 0) {
      showToast('No hay datos para exportar', 'error');
      return;
    }

    const data = allTramites.map(t => ({
      'N° Registro': t.nro_registro,
      'Tipo': t.tipo,
      'Origen (Remitente)': t.remitente,
      'Destino (Derivado A)': t.derivado_a || '—',
      'Asunto': t.asunto,
      'Prioridad': t.prioridad,
      'Fecha Recepción': t.fecha_recepcion,
      'Estado': t.estado,
      'Fecha Límite': t.fecha_limite || 'Sin plazo',
      'Observaciones': t.observaciones || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trámites");

    // Ajustar anchos de columna básicos
    const wscols = [
      {wch: 15}, {wch: 12}, {wch: 25}, {wch: 25}, {wch: 40}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 30}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "reporte_tramites.xlsx");
    showToast('Excel exportado correctamente');
  });
}

// ── Init ──────────────────────────────────────────────────────
document.getElementById('fecha-recepcion').valueAsDate = new Date();
checkAuth();
