/**
 * Tests for components/proyectos/create-proyecto-form.tsx.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateProyectoForm } from "@/components/proyectos/create-proyecto-form";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const espacios = [
  { id: "esp-1", nombre: "Espacio Norte", color: "#C9822F" },
  { id: "esp-2", nombre: "Espacio Sur", color: "#0E6B4F" },
];

describe("CreateProyectoForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders inputs for nombre, ambiente and a color picker", () => {
    render(<CreateProyectoForm espacioId="esp-1" onSuccess={jest.fn()} />);
    expect(screen.getByLabelText(/nombre del proyecto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ambiente$/i)).toBeInTheDocument();
    // Color picker expone los 8 swatches default
    expect(screen.getByRole("button", { name: "Seleccionar color #C9822F" })).toBeInTheDocument();
  });

  it("renders the espacio selector when no espacioId is provided", () => {
    render(
      <CreateProyectoForm espacios={espacios} onSuccess={jest.fn()} />,
    );
    const select = screen.getByLabelText(/espacio/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Espacio Norte" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Espacio Sur" })).toBeInTheDocument();
  });

  it("hides the espacio selector when espacioId is provided", () => {
    render(<CreateProyectoForm espacioId="esp-1" espacios={espacios} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText(/^espacio$/i)).not.toBeInTheDocument();
  });

  it("shows 'Debes seleccionar un espacio' when submitting without espacio (in selector mode)", async () => {
    const onSuccess = jest.fn();
    const { container } = render(
      <CreateProyectoForm espacios={espacios} onSuccess={onSuccess} />,
    );

    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), {
      target: { value: "Mi Proyecto" },
    });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), {
      target: { value: "QA" },
    });
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Debes seleccionar un espacio")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("POSTs to /api/proyectos with the form payload and calls onSuccess on 200", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "p-new" }) }),
    ) as jest.Mock;

    const onSuccess = jest.fn();
    const { container } = render(
      <CreateProyectoForm espacioId="esp-1" onSuccess={onSuccess} />,
    );

    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), {
      target: { value: "Mi Proyecto" },
    });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), {
      target: { value: "QA" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/proyectos",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody).toEqual({
      nombre: "Mi Proyecto",
      ambiente: "QA",
      espacioId: "esp-1",
      color: "#C9822F",
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("calls router.refresh() when there is no onSuccess handler", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "p-new" }) }),
    ) as jest.Mock;

    const { container } = render(<CreateProyectoForm espacioId="esp-1" />);

    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), {
      target: { value: "QA" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows backend validation error on 400", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Datos inválidos" }),
      }),
    ) as jest.Mock;

    const { container } = render(
      <CreateProyectoForm espacioId="esp-1" onSuccess={jest.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), { target: { value: "QA" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Datos inválidos")).toBeInTheDocument();
  });

  it("shows 'No tienes permisos...' on 403", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }),
    ) as jest.Mock;

    const { container } = render(
      <CreateProyectoForm espacioId="esp-1" onSuccess={jest.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText(/^ambiente$/i), { target: { value: "QA" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(
      await screen.findByText("No tienes permisos para crear proyectos"),
    ).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = jest.fn();
    render(<CreateProyectoForm espacioId="esp-1" onSuccess={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});