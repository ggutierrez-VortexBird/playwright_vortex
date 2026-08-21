'use client';

import { useState } from 'react';
import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import type { Espacio } from '@/types/espacio';

interface EspacioSwitcherProps {
  espacios: Espacio[];
}

export function EspacioSwitcher({ espacios }: EspacioSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const segments = useSelectedLayoutSegments();

  // Detect active espacio from URL pattern: espacios/[id]
  const activeEspacioIdFromUrl = segments.length >= 2 && segments[0] === 'espacios'
    ? segments[1]
    : undefined;
  const activeEspacio = espacios.find((e) => e.id === activeEspacioIdFromUrl);

  function handleSelectEspacio(espacioId: string) {
    setIsOpen(false);
    router.push(`/espacios/${espacioId}/proyectos`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-white hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {activeEspacio ? (
          <>
            <span
              className="sw-mark"
              style={{ backgroundColor: activeEspacio.color }}
            />
            <span>{activeEspacio.nombre}</span>
          </>
        ) : (
          <span className="text-white">Seleccionar espacio</span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded border border-white/20 bg-ink py-1 shadow-lg"
          role="listbox"
        >
          {espacios.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/60">
              No hay espacios creados
            </div>
          ) : (
            espacios.map((espacio) => (
              <button
                key={espacio.id}
                type="button"
                onClick={() => handleSelectEspacio(espacio.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
                role="option"
                aria-selected={espacio.id === activeEspacioIdFromUrl}
              >
                <span
                  className="sw-mark"
                  style={{ backgroundColor: espacio.color }}
                />
                <span>{espacio.nombre}</span>
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
