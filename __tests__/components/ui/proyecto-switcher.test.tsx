import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { ProjectProvider } from "@/components/project-context";

const mockPush = jest.fn();

jest.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: mockPush,
    }),
    useSelectedLayoutSegments: () => ["proyectos", "p1"],
  };
});

const mockProject = {
  id: "p1",
  nombre: "Proyecto 1",
  espacioId: "e1",
  activo: true,
  espacio: { id: "e1", nombre: "Espacio 1", color: "#ff0000", activo: true, createdAt: new Date(), updatedAt: new Date() },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProject2 = {
  id: "p2",
  nombre: "Proyecto 2",
  espacioId: "e1",
  activo: true,
  espacio: { id: "e1", nombre: "Espacio 1", color: "#00ff00", activo: true, createdAt: new Date(), updatedAt: new Date() },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderWithProvider(ui: React.ReactElement) {
  return render(<ProjectProvider>{ui}</ProjectProvider>);
}

describe("ProyectoSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("single project", () => {
    it("renders static header with project name when only one project", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[mockProject]} />);
      });
      
      expect(screen.getByText("Proyecto 1")).toBeInTheDocument();
      // No dropdown button should be present for single project
      expect(screen.queryByRole("button", { hidden: true })).not.toBeInTheDocument();
    });

    it("renders project name with color marker", async () => {
      const projectAlpha = {
        ...mockProject,
        id: "p-alpha",
        nombre: "Proyecto Alpha",
        espacio: { ...mockProject.espacio, color: "#00ff00" },
      };
      
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[projectAlpha]} />);
      });

      const projectName = screen.getByText("Proyecto Alpha");
      expect(projectName).toBeInTheDocument();
    });
  });

  describe("multiple projects", () => {
    it("renders dropdown button when multiple projects", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[mockProject, mockProject2]} />);
      });

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("shows active project highlighted in dropdown", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[mockProject, mockProject2]} />);
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        const selectedOption = screen.getByRole("option", { selected: true });
        expect(selectedOption).toHaveTextContent("Proyecto 1");
      });
    });

    it("calls router.push with correct URL when project clicked", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[mockProject, mockProject2]} />);
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        fireEvent.click(options[1]); // Click on "Proyecto 2"
      });

      expect(mockPush).toHaveBeenCalledWith("/proyectos/p2/casos");
    });

    it("shows 'No hay proyectos activos' when proyecto list is empty", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[]} />);
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("No hay proyectos activos")).toBeInTheDocument();
      });
    });

    it("closes dropdown when clicking outside", async () => {
      await act(async () => {
        renderWithProvider(<ProyectoSwitcher proyectos={[mockProject, mockProject2]} />);
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Click on the overlay (outside)
      const overlay = document.querySelector(".fixed.inset-0");
      fireEvent.click(overlay!);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });
});
