import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCasoForm } from "@/components/casos/create-caso-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/components/casos/responsable-select", () => ({
  ResponsableSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="responsable-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Selecciona un responsable</option>
      <option value="user-1">ana@test.com</option>
      <option value="user-2">luis@test.com</option>
    </select>
  ),
}));

jest.mock("@/components/casos/script-select", () => ({
  ScriptSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="script-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Selecciona un script</option>
      <option value="tests/login.spec.ts">login.spec.ts</option>
      <option value="tests/dup.spec.ts">dup.spec.ts</option>
    </select>
  ),
}));

describe("CreateCasoForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all form fields", () => {
    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={jest.fn()} />);
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByTestId("script-select")).toBeInTheDocument();
    expect(screen.getByTestId("responsable-select")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear caso/i })).toBeInTheDocument();
  });

  it("submits to POST /api/casos on valid input", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "caso-1", codigo: "CP-01" }),
      })
    ) as jest.Mock;

    const onSuccess = jest.fn();
    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "CP-01" } });
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Caso de login" } });
    fireEvent.change(screen.getByTestId("script-select"), { target: { value: "tests/login.spec.ts" } });
    fireEvent.change(screen.getByTestId("responsable-select"), { target: { value: "user-1" } });

    fireEvent.click(screen.getByRole("button", { name: /crear caso/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/casos",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: "CP-01",
            nombre: "Caso de login",
            rutaScript: "tests/login.spec.ts",
            responsableId: "user-1",
            proyectoId: "proyecto-1",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows validation error from backend", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "validation", message: "Script no accesible" }),
      })
    ) as jest.Mock;

    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "CP-01" } });
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Caso de login" } });
    fireEvent.change(screen.getByTestId("script-select"), { target: { value: "tests/login.spec.ts" } });
    fireEvent.change(screen.getByTestId("responsable-select"), { target: { value: "user-1" } });

    fireEvent.click(screen.getByRole("button", { name: /crear caso/i }));

    await waitFor(() => {
      expect(screen.getByText("Script no accesible")).toBeInTheDocument();
    });
  });

  it("shows duplicate code error from backend", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: "conflict", message: "Código duplicado en este proyecto" }),
      })
    ) as jest.Mock;

    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "CP-DUP" } });
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Caso dup" } });
    fireEvent.change(screen.getByTestId("script-select"), { target: { value: "tests/dup.spec.ts" } });
    fireEvent.change(screen.getByTestId("responsable-select"), { target: { value: "user-1" } });

    fireEvent.click(screen.getByRole("button", { name: /crear caso/i }));

    await waitFor(() => {
      expect(screen.getByText("Código duplicado en este proyecto")).toBeInTheDocument();
    });
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = jest.fn();
    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows error when responsable is not selected", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "caso-1" }),
      })
    ) as jest.Mock;

    render(<CreateCasoForm proyectoId="proyecto-1" onSuccess={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "CP-01" } });
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Caso de login" } });
    fireEvent.change(screen.getByTestId("script-select"), { target: { value: "tests/login.spec.ts" } });
    // Leave responsable unselected

    fireEvent.click(screen.getByRole("button", { name: /crear caso/i }));

    await waitFor(() => {
      expect(screen.getByText("Debes seleccionar un responsable")).toBeInTheDocument();
    });
  });

  it("shows proyecto selector when no proyectoId is provided", () => {
    const proyectos = [
      { id: "p-1", nombre: "Proyecto A", espacioNombre: "Espacio X" },
      { id: "p-2", nombre: "Proyecto B", espacioNombre: "Espacio Y" },
    ];
    render(<CreateCasoForm proyectos={proyectos} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText(/proyecto/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proyecto A (Espacio X)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proyecto B (Espacio Y)" })).toBeInTheDocument();
  });

  it("hides proyecto selector when proyectoId is provided", () => {
    const proyectos = [
      { id: "p-1", nombre: "Proyecto A", espacioNombre: "Espacio X" },
    ];
    render(<CreateCasoForm proyectoId="proyecto-1" proyectos={proyectos} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText(/proyecto/i)).not.toBeInTheDocument();
  });

  it("submits with selected proyecto from selector", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "caso-1", codigo: "CP-01" }),
      })
    ) as jest.Mock;

    const onSuccess = jest.fn();
    const proyectos = [
      { id: "p-1", nombre: "Proyecto A", espacioNombre: "Espacio X" },
    ];
    render(<CreateCasoForm proyectos={proyectos} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/proyecto/i), { target: { value: "p-1" } });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "CP-01" } });
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Caso de login" } });
    fireEvent.change(screen.getByTestId("script-select"), { target: { value: "tests/login.spec.ts" } });
    fireEvent.change(screen.getByTestId("responsable-select"), { target: { value: "user-1" } });

    fireEvent.click(screen.getByRole("button", { name: /crear caso/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/casos",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: "CP-01",
            nombre: "Caso de login",
            rutaScript: "tests/login.spec.ts",
            responsableId: "user-1",
            proyectoId: "p-1",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
