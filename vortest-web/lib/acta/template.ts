/**
 * HU-G19 — Plantilla HTML del acta de evidencia (PDF).
 *
 * Renderiza una página A4 con los datos de la ejecución:
 *   - Encabezado: caso, código, ambiente, navegador, sistema operativo
 *   - Resumen: resultado, duración, inicio/fin, aserciones
 *   - Lista de pasos con estado (conforme / no conforme)
 *   - Tabla de entorno
 *   - Sello "Conforme" o "No conforme" + consecutivo del acta
 *
 * Devuelve HTML listo para `page.setContent(html)` en Playwright.
 * Etiquetas desde lib/ejecuciones/estado.ts; colores fijos de la marca porque el PDF no lee los tokens CSS.
 */

import type { ActaTemplateInput } from "./types";
import { formatDuration, formatFecha } from "@/lib/format";
import { estadoLabel, resultadoEjecucionLabel } from "@/lib/ejecuciones/estado";

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

const COLOR_ESTADO: Record<string, string> = {
  paso: "#16753a",
  fallo: "#b3261e",
  errorMotor: "#8a5700",
};

function statusLabel(estado: string): string {
  return estadoLabel(estado, "paso");
}

function statusColor(estado: string): string {
  return COLOR_ESTADO[estado] ?? "#43575b";
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
  const resultadoLabel = resultadoEjecucionLabel(ejecucion.estado, failedPaso?.numero);
  const resultadoColor = COLOR_ESTADO[ejecucion.estado] ?? "#152427";

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
    color: #152427;
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
    border-bottom: 2px solid #152427;
    padding-bottom: 12px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .header h1 { font-size: 18pt; margin-bottom: 4px; }
  .header .sub { color: #6e8286; font-size: 9pt; }
  .header .meta { text-align: right; font-size: 9pt; color: #43575b; }
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
    background: #f5f8f8;
    border-radius: 4px;
  }
  .stats .k {
    font-size: 8pt;
    text-transform: uppercase;
    color: #6e8286;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .stats .v {
    font-size: 11pt;
    font-weight: 600;
    color: #152427;
  }
  .section {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #152427;
    border-bottom: 1px solid #c5d1d3;
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
    border-bottom: 1px solid #e3eaea;
    vertical-align: top;
  }
  th {
    background: #eef3f3;
    font-weight: 600;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td.num { width: 36px; text-align: right; color: #6e8286; }
  td.estado {
    width: 100px;
    font-weight: 600;
    font-size: 9pt;
  }
  td.dur { width: 64px; text-align: right; color: #43575b; }
  .firma {
    margin-top: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    page-break-inside: avoid;
  }
  .firma .box {
    border-top: 1px solid #152427;
    padding-top: 4px;
    font-size: 9pt;
    color: #6e8286;
  }
  .footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #c5d1d3;
    font-size: 8pt;
    color: #6e8286;
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
      <div><strong>Generado</strong> ${escapeHtml(formatFecha(generadoEn))}</div>
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
      <div class="v" style="font-size:10pt">${escapeHtml(formatFecha(ejecucion.inicioAt))}</div>
    </div>
    <div>
      <div class="k">Fin</div>
      <div class="v" style="font-size:10pt">${escapeHtml(formatFecha(ejecucion.finAt))}</div>
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
        <div style="padding:8px 12px;background:#fbe7e6;border-left:3px solid #b3261e;border-radius:2px;font-family:monospace;font-size:9pt">${escapeHtml(ejecucion.errorMsg)}</div>
      </div>`
      : ""
  }

  <div class="firma">
    <div class="box">Ejecutado por<br /><strong>${escapeHtml(ejecucion.nodoEjecucion ?? "sistema")}</strong></div>
    <div class="box">Validado por<br /><strong>VorTest · ${escapeHtml(actaConsecutivo)}</strong></div>
  </div>

  <div class="footer">
    Acta generada automáticamente por VorTest · ${escapeHtml(formatFecha(generadoEn))} ·
    Esta acta certifica la ejecución automatizada del caso ${escapeHtml(caso.codigo)}.
  </div>
</body>
</html>`;
}