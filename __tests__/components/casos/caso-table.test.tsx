import { render, screen, fireEvent, within } from "@testing-library/react";
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
    parentCaseId: null,
    parentCaseCodigo: null,
    estado: "paso",
    origen: "subirScript",
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
    parentCaseId: null,
    parentCaseCodigo: null,
    estado: "fallo",
    origen: "grabador",
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
    parentCaseId: null,
    parentCaseCodigo: null,
    estado: "sin ejecuciones",
    origen: "mixto",
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
    expect(screen.getByText("Caso")).toBeInTheDocument();
    expect(screen.getByText("Responsable")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Última ejecución")).toBeInTheDocument();
  });

  it("renders all casos rows", () => {
    render(<CasoTable casos={mockCasos} />);
    // El componente renderiza DOS vistas (md:table y móvil:cards), ambas en
    // el DOM — verificamos que cada código aparezca AL MENOS una vez.
    expect(screen.getAllByText("CP-TEST-01").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CP-TEST-02").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CP-TEST-03").length).toBeGreaterThanOrEqual(1);
  });

  it("renders estado pills with correct labels", () => {
    render(<CasoTable casos={mockCasos} />);
    // Cada estado aparece tanto en la fila de tabla como en la card móvil.
    expect(screen.getAllByText("Pasó").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Falló en el paso 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sin ejecutar").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = jest.fn();
    render(<CasoTable casos={mockCasos} canEdit onEdit={onEdit} />);
    // Buscamos dentro de la tabla para evitar ambigüedad entre la fila
    // desktop y la card móvil.
    const table = screen.getByRole("table");
    const row = within(table).getByText("CP-TEST-01").closest("tr");
    if (!row) throw new Error("Row not found");
    const editBtn = row.querySelector("button[aria-label='Editar']");
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn!);
    expect(onEdit).toHaveBeenCalledWith(mockCasos[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = jest.fn();
    render(<CasoTable casos={mockCasos} canEdit onDelete={onDelete} />);
    const table = screen.getByRole("table");
    const row = within(table).getByText("CP-TEST-01").closest("tr");
    if (!row) throw new Error("Row not found");
    const deleteBtn = row.querySelector("button[aria-label='Eliminar']");
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalledWith(mockCasos[0]);
  });

  it("links código and nombre to the caso detail page", () => {
    // Antes de este fix no había forma de llegar a /casos/[id] desde
    // ningún lado de la interfaz — quedaba inalcanzable.
    render(<CasoTable casos={mockCasos} />);
    // Tomamos el primer <a> con ese href (tabla o card móvil — ambos
    // tienen el mismo href esperado).
    const links = screen.getAllByRole("link", { name: "CP-TEST-01" });
    expect(links[0]).toHaveAttribute("href", "/casos/caso-1");
    const nombreLinks = screen.getAllByRole("link", { name: "Caso de prueba A" });
    expect(nombreLinks[0]).toHaveAttribute("href", "/casos/caso-1");
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
