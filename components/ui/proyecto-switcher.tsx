'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import type { ProyectoWithEspacio } from '@/types/proyecto';
import { useProject } from '@/components/project-context';

interface ProyectoSwitcherProps {
  proyectos: ProyectoWithEspacio[];
}

export function ProyectoSwitcher({ proyectos }: ProyectoSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const segments = useSelectedLayoutSegments();
  const { activeProject, setActiveProject } = useProject();

  // Detect active proyecto from URL pattern: proyectos/[id]
  const activeProyectoIdFromUrl = segments.length >= 2 && segments[0] === 'proyectos'
    ? segments[1]
    : undefined;
  
  // Use context if available, otherwise fall back to URL detection
  const activeProyecto = activeProject ?? proyectos.find((p) => p.id === activeProyectoIdFromUrl);

  // Sync context when URL changes (e.g., navigating via link)
  useEffect(() => {
    if (activeProyectoIdFromUrl) {
      const proyecto = proyectos.find((p) => p.id === activeProyectoIdFromUrl);
      if (proyecto && (!activeProject || activeProject.id !== proyecto.id)) {
        setActiveProject(proyecto);
      }
    }
  }, [activeProyectoIdFromUrl, proyectos, activeProject, setActiveProject]);

  // Single project: static header
  if (proyectos.length === 1) {
    const proyecto = proyectos[0];
    // Sync context with single project on mount
    if (!activeProject) {
      setActiveProject(proyecto);
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-white">
        <span
          className="sw-mark"
          style={{ backgroundColor: proyecto.espacio.color }}
        />
        <span className="font-medium">{proyecto.nombre}</span>
      </div>
    );
  }

  // Multiple projects: dropdown
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-white hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {activeProyecto ? (
          <>
            <span
              className="sw-mark"
              style={{ backgroundColor: activeProyecto.espacio.color }}
            />
            <span>{activeProyecto.nombre}</span>
          </>
        ) : (
          <span className="text-white/60">Seleccionar proyecto</span>
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
          className="absolute left-0 top-full z-50 mt-1 min-w-64 rounded border border-white/20 bg-ink py-1 shadow-lg"
          role="listbox"
        >
          {proyectos.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/60">
              No hay proyectos activos
            </div>
          ) : (
            proyectos.map((proyecto) => (
              <button
                key={proyecto.id}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setActiveProject(proyecto);
                  router.push(`/proyectos/${proyecto.id}/casos`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
                role="option"
                aria-selected={proyecto.id === (activeProyectoIdFromUrl ?? activeProject?.id)}
              >
                <span
                  className="sw-mark"
                  style={{ backgroundColor: proyecto.espacio.color }}
                />
                <span className="font-medium">{proyecto.nombre}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/60 truncate">{proyecto.espacio.nombre}</span>
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
