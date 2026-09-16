/**
 * Tests for components/proyectos/proyecto-card.tsx.
 *
 * Notas:
 *   - El componente calcula un texto relativo ("hace X min", "ayer", etc.)
 *     basado en `Date.now()`. Para que las aserciones sean estables fijamos
 *     `Date.now` con jest.spyOn en beforeEach.
 *   - Usa `<Link>` de next/link; next/jest lo sustituye por un <a> nativo,
 *     por lo que basta con `getByRole("link", { name: "Ver" })`.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ProyectoCard } from "@/components/proyectos/proyecto-card";
import type { ProyectoWithMetrics } from "@/types/proyecto";

const FIXED_NOW = new Date("2026-09-15T12:00:00Z").getTime();

const baseProyecto: ProyectoWithMetrics = {
  id: "pry-1234",
  espacioId: "esp-1",
  nombre: "Catastro Medellín",
  ambiente: "QA",
  descripcion: null,
  versionSistema: null,
  color: "#C9822F",
  activo: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  totalCasos: 12,
  casosConformes: 9,
  casosNoConformes: 3,
  fechaUltimaEjecucion: new Date(FIXED_NOW - 60 * 60 * 1000).toISOString(),
};

describe("ProyectoCard", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
    jest.restoreAllMocks();
  });

  it("renders the proyecto name and ambiente", () => {
    render(<ProyectoCard proyecto={baseProyecto} />);
    expect(screen.getByText("Catastro Medellín")).toBeInTheDocument();
    // El ambiente "QA" aparece DOS veces en la card (píldora + línea de
    // metadata del footer) — verificamos que aparezca al menos una vez.
    expect(screen.getAllByText("QA").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the project codigo formatted as #PRY-PRY1", () => {
    // `codigoProyecto(id)` quita guiones y toma los primeros 4 chars
    // uppercased. Para "pry-1234" eso da "PRY1" → "#PRY-PRY1".
    render(<ProyectoCard proyecto={baseProyecto} />);
    expect(screen.getByText("#PRY-PRY1")).toBeInTheDocument();
  });

  it("renders the metrics (totales, conformes, no conformes)", () => {
    render(<ProyectoCard proyecto={baseProyecto} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the relative date for fechaUltimaEjecucion (hace 1 h)", () => {
    render(<ProyectoCard proyecto={baseProyecto} />);
    expect(screen.getByText(/hace 1 h/)).toBeInTheDocument();
  });

  it("shows 'sin ejecuciones' when fechaUltimaEjecucion is null", () => {
    render(
      <ProyectoCard proyecto={{ ...baseProyecto, fechaUltimaEjecucion: null }} />,
    );
    expect(screen.getByText(/sin ejecuciones/i)).toBeInTheDocument();
  });

  it("links the 'Ver' button to /proyectos/{id}/casos", () => {
    render(<ProyectoCard proyecto={baseProyecto} />);
    const link = screen.getByRole("link", { name: /ver/i });
    expect(link).toHaveAttribute("href", "/proyectos/pry-1234/casos");
  });

  it("uses the proyecto.color as the header background", () => {
    const { container } = render(<ProyectoCard proyecto={baseProyecto} />);
    const header = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(header.style.backgroundColor).toBe("rgb(201, 130, 47)");
  });

  it("calls onEdit with the proyecto when the edit button is clicked", () => {
    const onEdit = jest.fn();
    render(<ProyectoCard proyecto={baseProyecto} canEdit onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /editar proyecto/i }));
    expect(onEdit).toHaveBeenCalledWith(baseProyecto);
  });

  it("calls onDelete when the delete button is clicked", () => {
    const onDelete = jest.fn();
    render(<ProyectoCard proyecto={baseProyecto} canEdit onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /eliminar proyecto/i }));
    expect(onDelete).toHaveBeenCalledWith(baseProyecto);
  });

  it("does NOT render edit/delete buttons when canEdit is false", () => {
    render(<ProyectoCard proyecto={baseProyecto} onEdit={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /editar proyecto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar proyecto/i })).not.toBeInTheDocument();
  });
});