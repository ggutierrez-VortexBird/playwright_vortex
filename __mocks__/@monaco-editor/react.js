/**
 * Manual Jest mock de @monaco-editor/react.
 *
 * El editor real carga el bundle de Monaco desde un CDN en el navegador
 * (vía @monaco-editor/loader) — no corre en jsdom y no aporta nada a un
 * test unitario. Este mock sustituye <Editor/> por un <textarea> con el
 * mismo contrato de props que usan los componentes (`value`, `onChange`),
 * suficiente para probar el flujo de edición sin levantar Monaco de
 * verdad. Los componentes reales envuelven <Editor/> en un contenedor con
 * su propio data-testid — los tests apuntan a este textarea por role.
 */
const React = require("react");

function Editor({ value, onChange, defaultValue }) {
  return React.createElement("textarea", {
    "data-testid": "monaco-editor-mock",
    value: value ?? defaultValue ?? "",
    onChange: (e) => onChange?.(e.target.value, e),
  });
}

module.exports = { Editor, default: Editor };
