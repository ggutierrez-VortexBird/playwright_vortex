'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { ProyectoWithEspacio } from '@/types/proyecto';

interface ProjectContextValue {
  activeProject: ProyectoWithEspacio | null;
  setActiveProject: (project: ProyectoWithEspacio | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
  initialProject?: ProyectoWithEspacio | null;
}

export function ProjectProvider({ children, initialProject = null }: ProjectProviderProps) {
  const [activeProject, setActiveProject] = useState<ProyectoWithEspacio | null>(initialProject);

  const handleSetActiveProject = useCallback((project: ProyectoWithEspacio | null) => {
    setActiveProject(project);
  }, []);

  const value = useMemo(
    () => ({ activeProject, setActiveProject: handleSetActiveProject }),
    [activeProject, handleSetActiveProject]
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
