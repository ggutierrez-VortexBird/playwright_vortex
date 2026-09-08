"use client";

import { useState, useRef } from "react";

interface ScriptFileInputProps {
  fileName?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = [".spec.ts", ".test.ts", ".spec.js", ".test.js"];

function isValidScriptFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function ScriptFileInput({ fileName, onChange, disabled }: ScriptFileInputProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentName = selectedFile?.name || fileName;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setValidationError(null);

    if (file && !isValidScriptFile(file.name)) {
      setValidationError(
        `El archivo "${file.name}" no es válido. Debe terminar en ${ALLOWED_EXTENSIONS.join(" o ")}.`
      );
      setSelectedFile(null);
      onChange(null);
      // Reset input para permitir re-seleccionar el mismo archivo si se corrige
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    onChange(file);
  }

  function handleReset() {
    setSelectedFile(null);
    setValidationError(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div>
      {currentName && (
        <div className="mb-2 flex items-center gap-2 text-sm text-m3-on-surface-variant">
          <span>
            Archivo:{" "}
            <code className="rounded bg-m3-surface-container-high px-1 py-0.5 text-m3-on-surface">{currentName}</code>
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-m3-error hover:underline"
            disabled={disabled}
          >
            Cambiar
          </button>
        </div>
      )}

      {!selectedFile && (
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          disabled={disabled}
          className="mt-1 block w-full text-sm text-m3-on-surface file:mr-4 file:rounded-md file:border-0 file:bg-m3-secondary-container file:px-4 file:py-2 file:text-sm file:font-medium file:text-m3-on-secondary-container hover:file:bg-m3-secondary-fixed disabled:opacity-50"
        />
      )}

      {validationError && (
        <p className="mt-1 text-xs text-m3-error">{validationError}</p>
      )}

      <p className="mt-1 text-xs text-m3-on-surface-variant">
        Archivos permitidos: {ALLOWED_EXTENSIONS.join(", ")}
      </p>
    </div>
  );
}
