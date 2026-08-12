'use client';

import { useProject } from '@/components/project-context';
import { ScopeBar } from '@/components/ui/scope-bar';

export function ScopeBarWithContext() {
  const { activeProject } = useProject();

  if (!activeProject) {
    return null;
  }

  return (
    <ScopeBar
      espacioNombre={activeProject.espacio.nombre}
      proyectoNombre={activeProject.nombre}
      espacioColor={activeProject.espacio.color}
    />
  );
}
