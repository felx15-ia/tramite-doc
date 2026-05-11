// ============================================================
//  GESTOR DOCUMENTARIO — SUPABASE CLIENT
//  Configuración y funciones de base de datos
// ============================================================

const SUPABASE_URL = 'https://ysxmpmtgsigwbvzavvfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzeG1wbXRnc2lnd2J2emF2dmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzcwNTUsImV4cCI6MjA5NDAxMzA1NX0.49j8MlzmCFAidbJQ5UQURdSpaS4HqMLn9__LHsmEA3U';

const TABLE = 'tramites';

// ── Helper fetch con manejo de errores ──────────────────────
async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

// ── CRUD ────────────────────────────────────────────────────

/** Obtener todos los trámites ordenados por fecha */
async function getTramites(search = '', estado = '') {
  let qs = `select=*&order=fecha_recepcion.desc`;
  if (search) {
    const enc = encodeURIComponent(search);
    // Buscamos en Nro Registro, Asunto, Remitente y Derivado A
    qs += `&or=(nro_registro.ilike.*${enc}*,asunto.ilike.*${enc}*,remitente.ilike.*${enc}*,derivado_a.ilike.*${enc}*)`;
  }
  if (estado) qs += `&estado=eq.${encodeURIComponent(estado)}`;
  return sbFetch(`${TABLE}?${qs}`);
}

/** Insertar un nuevo trámite */
async function createTramite(payload) {
  return sbFetch(TABLE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Actualizar estado de un trámite */
async function updateEstado(id, estado) {
  return sbFetch(`${TABLE}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
    headers: { 'Prefer': 'return=representation' },
  });
}

/** Eliminar un trámite */
async function deleteTramite(id) {
  return sbFetch(`${TABLE}?id=eq.${id}`, { method: 'DELETE' });
}

/** Verificar si un N° de registro ya existe */
async function existeRegistro(nro) {
  const r = await sbFetch(`${TABLE}?nro_registro=eq.${encodeURIComponent(nro)}&select=id`);
  return r && r.length > 0;
}

export {
  getTramites, createTramite, updateEstado, deleteTramite, existeRegistro
};
