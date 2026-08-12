import { render, screen, act, waitFor } from "@testing-library/react";
import { ProjectProvider, useProject } from "@/components/project-context";
import type { ProyectoWithEspacio } from "@/types/proyecto";
import React from "react";

// Test component to access context
function TestConsumer() {
  const { activeProject, setActiveProject } = useProject();
  return (
    <div>
      <span data-testid="project-name">{activeProject?.nombre ?? "no-project"}</span>
      <button onClick={() => setActiveProject(mockProject)}>Set Project</button>
      <button onClick={() => setActiveProject(null)}>Clear Project</button>
    </div>
  );
}

const mockProject: ProyectoWithEspacio = {
  id: "p1",
  espacioId: "e1",
  nombre: "Proyecto Test",
  ambiente: "test",
  descripcion: null,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  espacio: {
    id: "e1",
    nombre: "Espacio Test",
    color: "#ff0000",
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe("ProjectContext", () => {
  it("provides null as initial project", () => {
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );
    expect(screen.getByTestId("project-name")).toHaveTextContent("no-project");
  });

  it("allows setting active project", async () => {
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );
    
    await act(async () => {
      screen.getByText("Set Project").click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId("project-name")).toHaveTextContent("Proyecto Test");
    });
  });

  it("allows clearing active project", async () => {
    render(
      <ProjectProvider initialProject={mockProject}>
        <TestConsumer />
      </ProjectProvider>
    );
    
    expect(screen.getByTestId("project-name")).toHaveTextContent("Proyecto Test");
    
    await act(async () => {
      screen.getByText("Clear Project").click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId("project-name")).toHaveTextContent("no-project");
    });
  });

  it("throws error when useProject is used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useProject must be used within a ProjectProvider");
    
    consoleSpy.mockRestore();
  });
});
