# 📋 Gestión de Trámite Documentario — Jefatura

Sistema web completo para el registro, seguimiento y control de documentos en Jefatura.

---

## 🚀 Cómo abrir la aplicación

### Opción 1: Servidor local con Node.js (Recomendado)
```bash
# En la carpeta del proyecto:
npx serve .
```
Luego abre en tu navegador: **http://localhost:3000**

### Opción 2: VS Code Live Server
Instala la extensión **Live Server** y haz clic en "Go Live".

### ⚠️ Importante
Los archivos `.js` usan módulos ES (`import/export`), por lo que **NO funcionan si abres el HTML directamente** con doble clic (protocolo `file://`). Necesitas un servidor local.

---

## 🌐 URLs de la aplicación

| Vista | URL | Acceso |
|-------|-----|--------|
| **Admin (gestión completa)** | `http://localhost:3000/index.html` | Solo Jefatura |
| **Vista Pública (solo lectura)** | `http://localhost:3000/vista-publica.html` | Todo el equipo |

Para compartir la vista pública con tu equipo, puedes usar herramientas como:
- **ngrok**: `ngrok http 3000` → genera una URL pública temporal
- **Netlify Drop**: Arrastra la carpeta a [netlify.com/drop](https://netlify.com/drop) para hosting gratuito

---

## ✨ Funcionalidades

### Panel de Administración (`index.html`)
- ➕ **Registrar documentos** con validación de duplicados
- 📊 **KPIs en tiempo real**: total, en recibido, en firma, alertas
- 🔍 **Búsqueda** por asunto o remitente
- 🎛️ **Filtro por estado**
- 🔄 **Cambio de estado** con un clic: Recibido → En Firma → Derivado → Archivado
- 🗑️ **Eliminación** con confirmación
- ⏱️ **Días en Gestión** calculados automáticamente

### Sistema de Alertas
| Condición | Indicador |
|-----------|-----------|
| Estado "Recibido" y ≤ 3 días | Normal (sin resaltado) |
| Estado "Recibido" y > 3 días | 🟠 Fila naranja |
| Estado "Recibido" y > 5 días | 🔴 Fila roja |

### Vista Pública (`vista-publica.html`)
- 👁️ Solo lectura — sin botones de modificación
- 🔄 Auto-actualización cada **60 segundos**
- 🔍 Búsqueda y filtrado disponibles

---

## 🗄️ Base de Datos

- **Plataforma**: Supabase (PostgreSQL)
- **Proyecto**: GestorDocumentario
- **URL**: https://ysxmpmtgsigwbvzavvfg.supabase.co

### Campos de la tabla `tramites`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nro_registro` | TEXT UNIQUE | Número identificador del documento |
| `tipo` | TEXT | Oficio / Informe |
| `remitente` | TEXT | Quien envía el documento |
| `asunto` | TEXT | Descripción del asunto |
| `prioridad` | TEXT | Baja / Media / Alta |
| `fecha_recepcion` | DATE | Fecha en que se recibió |
| `estado` | TEXT | Recibido / En Firma / Derivado / Archivado |
| `observaciones` | TEXT | Notas adicionales |

---

## 📁 Estructura del proyecto

```
gestor documentarios/
├── index.html          → Panel de administración
├── vista-publica.html  → Vista pública (solo lectura)
├── css/
│   └── styles.css      → Design system completo
├── js/
│   ├── supabase.js     → Cliente de base de datos
│   ├── app.js          → Lógica del panel admin
│   └── readonly.js     → Lógica de vista pública
└── README.md           → Este archivo
```
