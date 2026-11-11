'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import type { ProyectoWithEspacio } from '@/types/proyecto';
import { useProject } from '@/components/project-context';
import { useEscape } from "@/components/ui/use-escape";

interface ProyectoSwitcherProps {
  proyectos: ProyectoWithEspacio[];
}

export function ProyectoSwitcher({ proyectos }: ProyectoSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const cerrarSwitcher = useCallback(() => setIsOpen(false), []);
  useEscape(isOpen, cerrarSwitcher);
  const router = useRouter();
  const segments = useSelectedLayoutSegments();
  const { activeProject, setActiveProject } = useProject();

  // Detecta el proyecto activo desde la URL: proyectos/[id]
  const activeProyectoIdFromUrl = segments.length >= 2 && segments[0] === 'proyectos'
    ? segments[1]
    : undefined;
  
  // Usa el contexto si existe, si no la URL
  const activeProyecto = activeProject ?? proyectos.find((p) => p.id === activeProyectoIdFromUrl);

  // Sincroniza el contexto cuando cambia la URL
  useEffect(() => {
    if (activeProyectoIdFromUrl) {
      const proyecto = proyectos.find((p) => p.id === activeProyectoIdFromUrl);
      if (proyecto && (!activeProject || activeProject.id !== proyecto.id)) {
        setActiveProject(proyecto);
      }
    }
  }, [activeProyectoIdFromUrl, proyectos, activeProject, setActiveProject]);

  // Sincroniza el contexto si hay un solo proyecto
  useEffect(() => {
    if (proyectos.length === 1 && !activeProject) {
      setActiveProject(proyectos[0]);
    }
  }, [proyectos, activeProject, setActiveProject]);

  // Un proyecto: encabezado estático
  if (proyectos.length === 1) {
    const proyecto = proyectos[0];
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

  // Varios proyectos: desplegable
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
          className="scroll-hidden absolute left-0 top-full z-dropdown mt-1 max-h-72 min-w-64 overflow-y-auto rounded border border-white/20 bg-m3-primary-container py-1 shadow-lg"
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
          className="fixed inset-0 z-dropdown"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
