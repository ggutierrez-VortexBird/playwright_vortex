"use client";

import { useState, useRef } from "react";

interface ScriptFileInputProps {
  fileName?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = [".spec.ts", ".test.ts", ".spec.js", ".test.js", ".ts", ".js"];

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
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-3">
          <span>
            Archivo:{" "}
            <code className="rounded bg-rule px-1 py-0.5 text-ink">{currentName}</code>
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-stamp hover:underline"
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
          className="mt-1 block w-full text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-client file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-client/90 disabled:opacity-50"
        />
      )}

      {validationError && (
        <p className="mt-1 text-xs text-stamp">{validationError}</p>
      )}

      <p className="mt-1 text-xs text-ink-3">
        Archivos permitidos: {ALLOWED_EXTENSIONS.join(", ")}
      </p>
    </div>
  );
}
