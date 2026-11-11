// Mock de @monaco-editor/react: sustituye el editor por un textarea con las mismas props.
const React = require("react");

function Editor({ value, onChange, defaultValue }) {
  return React.createElement("textarea", {
    "data-testid": "monaco-editor-mock",
    value: value ?? defaultValue ?? "",
    onChange: (e) => onChange?.(e.target.value, e),
  });
}

module.exports = { Editor, default: Editor };
