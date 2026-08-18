import { render, screen, fireEvent } from "@testing-library/react";
import { CasoTable } from "@/components/casos/caso-table";
import type { CasoPruebaListItem } from "@/types/caso";

const mockCasos: CasoPruebaListItem[] = [
  {
    id: "caso-1",
    proyectoId: "proyecto-1",
    proyectoNombre: "Proyecto Alpha",
    codigo: "CP-TEST-01",
    nombre: "Caso de prueba A",
    scriptFileName: "login.spec.ts",
    responsableId: "user-1",
    responsableEmail: "ana@test.com",
    estado: "paso",
    activo: true,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
    fechaUltimaEjecucion: "2026-08-05T10:30:00Z",
    pasosCount: 5,
    ultimaEjecucionId: "ejec-1",
    primerPasoFallidoNumero: null,
  },
  {
    id: "caso-2",
    proyectoId: "proyecto-1",
    proyectoNombre: "Proyecto Alpha",
    codigo: "CP-TEST-02",
    nombre: "Caso de prueba B",
    scriptFileName: "transferencia-muy-larga.spec.ts",
    responsableId: "user-2",
    responsableEmail: "luis@test.com",
    estado: "fallo",
    activo: true,
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    fechaUltimaEjecucion: null,
    pasosCount: 3,
    ultimaEjecucionId: null,
    primerPasoFallidoNumero: 2,
  },
  {
    id: "caso-3",
    proyectoId: "proyecto-2",
    proyectoNombre: "Proyecto Beta",
    codigo: "CP-TEST-03",
    nombre: "Caso de prueba C",
    scriptFileName: "consulta.spec.ts",
    responsableId: "user-1",
    responsableEmail: "ana@test.com",
    estado: "sin ejecuciones",
    activo: true,
    createdAt: "2026-08-03T00:00:00Z",
    updatedAt: "2026-08-03T00:00:00Z",
    fechaUltimaEjecucion: null,
    pasosCount: null,
    ultimaEjecucionId: null,
    primerPasoFallidoNumero: null,
  },
];

describe("CasoTable", () => {
  it("renders table headers", () => {
    render(<CasoTable casos={mockCasos} />);
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Responsable")).toBeInTheDocument();
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Última ejecución")).toBeInTheDocument();
  });

  it("renders all casos rows", () => {
    render(<CasoTable casos={mockCasos} />);
    expect(screen.getByText("CP-TEST-01")).toBeInTheDocument();
    expect(screen.getByText("CP-TEST-02")).toBeInTheDocument();
    expect(screen.getByText("CP-TEST-03")).toBeInTheDocument();
  });

  it("renders estado pills with correct labels", () => {
    render(<CasoTable casos={mockCasos} />);
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
    expect(screen.getByText("Falló en el paso 2")).toBeInTheDocument();
    expect(screen.getByText("Sin ejecutar")).toBeInTheDocument();
  });

  it("truncates long file names", () => {
    render(<CasoTable casos={mockCasos} />);
    const truncated = screen.getByText(/transferencia-muy-larga\.spec\.ts/);
    expect(truncated).toBeInTheDocument();
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = jest.fn();
    render(<CasoTable casos={mockCasos} canEdit onEdit={onEdit} />);
    const row = screen.getByText("CP-TEST-01").closest("tr");
    if (!row) throw new Error("Row not found");
    const editBtn = row.querySelector("button[aria-label='Editar']");
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn!);
    expect(onEdit).toHaveBeenCalledWith(mockCasos[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = jest.fn();
    render(<CasoTable casos={mockCasos} canEdit onDelete={onDelete} />);
    const row = screen.getByText("CP-TEST-01").closest("tr");
    if (!row) throw new Error("Row not found");
    const deleteBtn = row.querySelector("button[aria-label='Eliminar']");
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalledWith(mockCasos[0]);
  });

  it("does not show action buttons when canEdit is false", () => {
    render(<CasoTable casos={mockCasos} canEdit={false} />);
    expect(screen.queryByLabelText("Editar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar")).not.toBeInTheDocument();
  });

  it("renders empty state when no casos", () => {
    render(<CasoTable casos={[]} />);
    expect(screen.getByText("No hay casos de prueba")).toBeInTheDocument();
  });
});
