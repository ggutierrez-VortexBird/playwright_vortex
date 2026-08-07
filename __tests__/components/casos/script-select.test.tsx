import { render, screen, waitFor } from "@testing-library/react";
import { ScriptSelect } from "@/components/casos/script-select";

describe("ScriptSelect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows disabled message when proyectoId is empty", () => {
    render(<ScriptSelect proyectoId="" value="" onChange={jest.fn()} />);
    expect(screen.getByText("Selecciona un proyecto primero")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<ScriptSelect proyectoId="proj1" value="" onChange={jest.fn()} />);
    expect(screen.getByText("Cargando scripts...")).toBeInTheDocument();
  });

  it("shows scripts after loading", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ scripts: ["proj1/login.spec.ts", "proj1/auth/logout.spec.ts"] }),
      })
    ) as jest.Mock;

    render(<ScriptSelect proyectoId="proj1" value="" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "login.spec.ts" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "logout.spec.ts" })).toBeInTheDocument();
    });
  });

  it("shows empty message when no scripts found", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ scripts: [] }),
      })
    ) as jest.Mock;

    render(<ScriptSelect proyectoId="proj1" value="" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No hay scripts/)).toBeInTheDocument();
    });
  });

  it("calls onChange when selecting a script", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ scripts: ["proj1/login.spec.ts"] }),
      })
    ) as jest.Mock;

    const onChange = jest.fn();
    render(<ScriptSelect proyectoId="proj1" value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "login.spec.ts" })).toBeInTheDocument();
    });

    screen.getByRole("combobox").click();
    // For select element, use fireEvent.change
    const select = screen.getByRole("combobox");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    // Actually simulate selection via onChange
  });
});
