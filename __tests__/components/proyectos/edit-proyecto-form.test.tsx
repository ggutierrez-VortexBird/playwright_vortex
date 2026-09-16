/**
 * Tests for components/proyectos/edit-proyecto-form.tsx.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditProyectoForm } from "@/components/proyectos/edit-proyecto-form";
import type { ProyectoWithMetrics } from "@/types/proyecto";

// El componente usa <Switch> (Radix), que internamente requiere
// ResizeObserver. jsdom no lo provee — polyfill local en este test.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
  }
});

const baseProyecto: ProyectoWithMetrics = {
  id: "pry-1",
  espacioId: "esp-1",
  nombre: "Catastro Original",
  ambiente: "QA",
  descripcion: "Descripción inicial",
  versionSistema: "v1.0.0",
  color: "#C9822F",
  activo: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  totalCasos: 0,
  casosConformes: 0,
  casosNoConformes: 0,
  fechaUltimaEjecucion: null,
};

describe("EditProyectoForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pre-populates all inputs with the proyecto values", () => {
    render(<EditProyectoForm proyecto={baseProyecto} />);

    expect(screen.getByLabelText(/nombre del proyecto/i)).toHaveValue("Catastro Original");
    expect(screen.getByLabelText(/^ambiente$/i)).toHaveValue("QA");
    expect(screen.getByLabelText(/versión de sistema/i)).toHaveValue("v1.0.0");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción inicial");
    expect(screen.getByRole("button", { name: "Seleccionar color #C9822F" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reflects the proyecto's activo state in the switch", () => {
    render(<EditProyectoForm proyecto={baseProyecto} />);
    const sw = screen.getByRole("switch", { name: /proyecto activo/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("renders the 'activo' toggle correctly when activo=false", () => {
    render(<EditProyectoForm proyecto={{ ...baseProyecto, activo: false }} />);
    const sw = screen.getByRole("switch", { name: /proyecto activo/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("PUTs to /api/proyectos/{id} with the updated payload and calls onSuccess", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "pry-1" }) }),
    ) as jest.Mock;

    const onSuccess = jest.fn();
    const { container } = render(
      <EditProyectoForm proyecto={baseProyecto} onSuccess={onSuccess} />,
    );

    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), {
      target: { value: "Catastro Renombrado" },
    });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), {
      target: { value: "PROD" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/proyectos/pry-1",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.nombre).toBe("Catastro Renombrado");
    expect(body.ambiente).toBe("PROD");
    expect(body.color).toBe("#C9822F");
    expect(body.activo).toBe(true);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows backend validation error on 400", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "nombre es obligatorio" }),
      }),
    ) as jest.Mock;

    const { container } = render(
      <EditProyectoForm proyecto={baseProyecto} onSuccess={jest.fn()} />,
    );
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("nombre es obligatorio")).toBeInTheDocument();
  });

  it("shows 'No tienes permisos...' on 403", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }),
    ) as jest.Mock;

    const { container } = render(
      <EditProyectoForm proyecto={baseProyecto} onSuccess={jest.fn()} />,
    );
    fireEvent.submit(container.querySelector("form")!);

    expect(
      await screen.findByText("No tienes permisos para editar proyectos"),
    ).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = jest.fn();
    render(<EditProyectoForm proyecto={baseProyecto} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});