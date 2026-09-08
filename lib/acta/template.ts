/**
 * HU-G19 — Plantilla HTML del acta de evidencia (PDF).
 *
 * Renderiza una página A4 con los datos de la ejecución:
 *   - Encabezado: caso, código, ambiente, navegador, sistema operativo
 *   - Resumen: resultado, duración, inicio/fin, aserciones
 *   - Lista de pasos con estado (conforme / no conforme / reparado)
 *   - Tabla de entorno
 *   - Sello "Conforme" o "No conforme" + consecutivo del acta
 *
 * Devuelve HTML listo para `page.setContent(html)` en Playwright.
 * Reusa los tokens del dashboard (--ink, --stamp, --seal, --amber, etc.)
 * vía inline styles para que el PDF sea consistente con el UI.
 */

import type { ActaTemplateInput } from "./types";

/** Escape básico de HTML para evitar inyección desde campos libres. */
function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(estado: string): string {
  switch (estado) {
    case "paso":
      return "Conforme";
    case "fallo":
      return "No conforme";
    case "reparado":
      return "Reparado";
    case "skipped":
      return "Omitido";
    default:
      return estado;
  }
}

function statusColor(estado: string): string {
  switch (estado) {
    case "paso":
      return "#0e6b4f"; // --seal
    case "fallo":
      return "#a8322a"; // --stamp
    case "reparado":
      return "#a9741a"; // --amber
    default:
      return "#3a4b5c"; // --ink-2
  }
}

/**
 * Genera el HTML del acta de evidencia.
 * @param input Datos de la ejecución + consecutivo del acta.
 * @returns String HTML para Playwright `page.setContent`.
 */
export function renderActaHTML(input: ActaTemplateInput): string {
  const { ejecucion, actaConsecutivo, generadoEn } = input;
  const caso = ejecucion.casoPrueba;
  const proyecto = caso.proyecto;
  const espacio = proyecto.espacio;

  const failedPaso = ejecucion.pasos.find((p) => p.estado === "fallo");
  const resultadoLabel = ejecucion.estado === "paso"
    ? "Conforme"
    : ejecucion.estado === "fallo"
      ? `No conforme${failedPaso ? ` (paso ${failedPaso.numero})` : ""}`
      : ejecucion.estado === "reparado"
        ? "Reparado"
        : ejecucion.estado === "errorMotor"
          ? "Error motor"
          : "Pendiente";

  const resultadoColor =
    ejecucion.estado === "paso"
      ? "#0e6b4f"
      : ejecucion.estado === "fallo"
        ? "#a8322a"
        : ejecucion.estado === "reparado"
          ? "#a9741a"
          : "#131e2b";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Acta de evidencia · ${escapeHtml(actaConsecutivo)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #131e2b;
    font-size: 10.5pt;
    line-height: 1.4;
    margin: 0;
  }
  h1, h2, h3 { margin: 0; font-weight: 600; }
  .stamp {
    display: inline-block;
    padding: 4px 10px;
    font-size: 9pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 2px solid currentColor;
    border-radius: 3px;
  }
  .header {
    border-bottom: 2px solid #131e2b;
    padding-bottom: 12px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .header h1 { font-size: 18pt; margin-bottom: 4px; }
  .header .sub { color: #6b7c8d; font-size: 9pt; }
  .header .meta { text-align: right; font-size: 9pt; color: #3a4b5c; }
  .seal {
    display: inline-block;
    padding: 6px 14px;
    font-size: 11pt;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    border: 2px solid ${resultadoColor};
    color: ${resultadoColor};
    border-radius: 4px;
    margin-top: 8px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
    padding: 10px 12px;
    background: #f5f7f9;
    border-radius: 4px;
  }
  .stats .k {
    font-size: 8pt;
    text-transform: uppercase;
    color: #6b7c8d;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .stats .v {
    font-size: 11pt;
    font-weight: 600;
    color: #131e2b;
  }
  .section {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #131e2b;
    border-bottom: 1px solid #d7e0e7;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }
  th, td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #e7edf1;
    vertical-align: top;
  }
  th {
    background: #eef2f5;
    font-weight: 600;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td.num { width: 36px; text-align: right; color: #6b7c8d; }
  td.estado {
    width: 100px;
    font-weight: 600;
    font-size: 9pt;
  }
  td.dur { width: 64px; text-align: right; color: #3a4b5c; }
  .firma {
    margin-top: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    page-break-inside: avoid;
  }
  .firma .box {
    border-top: 1px solid #131e2b;
    padding-top: 4px;
    font-size: 9pt;
    color: #6b7c8d;
  }
  .footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #d7e0e7;
    font-size: 8pt;
    color: #6b7c8d;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Acta de evidencia</h1>
      <div class="sub">${escapeHtml(caso.nombre)} · ${escapeHtml(caso.codigo)}</div>
      <div class="sub">${escapeHtml(proyecto.nombre)} · ${escapeHtml(espacio.nombre)}</div>
      <div class="seal">${escapeHtml(resultadoLabel)}</div>
    </div>
    <div class="meta">
      <div><strong>Consecutivo</strong> ${escapeHtml(actaConsecutivo)}</div>
      <div><strong>Generado</strong> ${escapeHtml(formatTimestamp(generadoEn))}</div>
      <div><strong>ID ejecución</strong> ${escapeHtml(ejecucion.id)}</div>
    </div>
  </div>

  <div class="stats">
    <div>
      <div class="k">Resultado</div>
      <div class="v" style="color:${resultadoColor}">${escapeHtml(resultadoLabel)}</div>
    </div>
    <div>
      <div class="k">Duración</div>
      <div class="v">${escapeHtml(formatDuration(ejecucion.duracionMs))}</div>
    </div>
    <div>
      <div class="k">Inicio</div>
      <div class="v" style="font-size:10pt">${escapeHtml(formatTimestamp(ejecucion.inicioAt))}</div>
    </div>
    <div>
      <div class="k">Fin</div>
      <div class="v" style="font-size:10pt">${escapeHtml(formatTimestamp(ejecucion.finAt))}</div>
    </div>
  </div>

  <div class="section">
    <h2>Pasos ejecutados (${ejecucion.pasos.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Descripción</th>
          <th class="estado">Estado</th>
          <th class="dur">Duración</th>
        </tr>
      </thead>
      <tbody>
        ${ejecucion.pasos
          .map((p) => {
            const color = statusColor(p.estado);
            const label = statusLabel(p.estado);
            return `<tr>
              <td class="num">${p.numero}</td>
              <td>${escapeHtml(p.descripcion)}</td>
              <td class="estado" style="color:${color}">${escapeHtml(label)}</td>
              <td class="dur">${escapeHtml(formatDuration(p.duracionMs))}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Entorno</h2>
    <table>
      <tbody>
        <tr><th style="width:30%">Ambiente</th><td>${escapeHtml(ejecucion.entorno ?? proyecto.ambiente ?? "—")}</td></tr>
        <tr><th>Navegador</th><td>${escapeHtml(ejecucion.navegador ?? "—")}</td></tr>
        <tr><th>Sistema operativo</th><td>${escapeHtml(ejecucion.sistemaOperativo ?? "—")}</td></tr>
        <tr><th>Nodo de ejecución</th><td>${escapeHtml(ejecucion.nodoEjecucion ?? "—")}</td></tr>
        <tr><th>Aserciones</th><td>${ejecucion.asercionesTotal} total · ${ejecucion.asercionesOk} ok · ${ejecucion.asercionesFail} fallo</td></tr>
      </tbody>
    </table>
  </div>

  ${
    ejecucion.errorMsg
      ? `<div class="section">
        <h2>Detalle del error</h2>
        <div style="padding:8px 12px;background:#fbe7e6;border-left:3px solid #a8322a;border-radius:2px;font-family:monospace;font-size:9pt">${escapeHtml(ejecucion.errorMsg)}</div>
      </div>`
      : ""
  }

  <div class="firma">
    <div class="box">Ejecutado por<br /><strong>${escapeHtml(ejecucion.nodoEjecucion ?? "sistema")}</strong></div>
    <div class="box">Validado por<br /><strong>ACTA · ${escapeHtml(actaConsecutivo)}</strong></div>
  </div>

  <div class="footer">
    Acta generada automáticamente por ACTA · ${escapeHtml(formatTimestamp(generadoEn))} ·
    Esta acta certifica la ejecución automatizada del caso ${escapeHtml(caso.codigo)}.
  </div>
</body>
</html>`;
}