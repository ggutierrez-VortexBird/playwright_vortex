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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="scriptFile-input"
          className={`inline-flex cursor-pointer items-center rounded-lg bg-m3-secondary-container px-4 py-2 font-label text-label-md font-semibold text-m3-on-surface transition-opacity hover:opacity-90 ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Seleccionar archivo
        </label>
        <input
          id="scriptFile-input"
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          disabled={disabled}
          className="sr-only"
        />
        {currentName && (
          <span className="font-body text-body-sm text-m3-on-surface-variant">{currentName}</span>
        )}
      </div>

      {validationError && (
        <p className="mt-1 font-body text-body-sm text-m3-error">{validationError}</p>
      )}

      <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
        Archivos permitidos: {ALLOWED_EXTENSIONS.join(", ")}
      </p>
    </div>
  );
}
