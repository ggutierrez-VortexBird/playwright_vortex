"use client";

import { useState, useRef } from "react";

interface ScriptFileInputProps {
  fileName?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function ScriptFileInput({ fileName, onChange, disabled }: ScriptFileInputProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentName = selectedFile?.name || fileName;

  return (
    <div>
      {currentName && !selectedFile && (
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-3">
          <span>
            Archivo actual:{" "}
            <code className="rounded bg-rule px-1 py-0.5 text-ink">{currentName}</code>
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-client hover:underline"
            disabled={disabled}
          >
            Reemplazar
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".spec.ts,.test.ts"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setSelectedFile(file);
          onChange(file);
        }}
        disabled={disabled}
        className="mt-1 block w-full text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-client file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-client/90 disabled:opacity-50"
      />

      {selectedFile && (
        <p className="mt-1 text-xs text-seal">Seleccionado: {selectedFile.name}</p>
      )}

      <p className="mt-1 text-xs text-ink-3">
        Archivos permitidos: .spec.ts, .test.ts
      </p>
    </div>
  );
}
