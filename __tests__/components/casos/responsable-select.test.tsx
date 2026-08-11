import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResponsableSelect } from "@/components/casos/responsable-select";

describe("ResponsableSelect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<ResponsableSelect value="" onChange={jest.fn()} />);
    expect(screen.getByText("Cargando usuarios...")).toBeInTheDocument();
  });

  it("renders users after fetch", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          usuarios: [
            { id: "user-1", email: "ana@test.com" },
            { id: "user-2", email: "luis@test.com" },
          ],
        }),
      })
    ) as jest.Mock;

    render(<ResponsableSelect value="" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("ana@test.com")).toBeInTheDocument();
      expect(screen.getByText("luis@test.com")).toBeInTheDocument();
    });
  });

  it("calls onChange when selection changes", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          usuarios: [
            { id: "user-1", email: "ana@test.com" },
            { id: "user-2", email: "luis@test.com" },
          ],
        }),
      })
    ) as jest.Mock;

    const onChange = jest.fn();
    render(<ResponsableSelect value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText("ana@test.com")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "user-2" } });
    expect(onChange).toHaveBeenCalledWith("user-2");
  });

  it("shows error when fetch fails", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    ) as jest.Mock;

    render(<ResponsableSelect value="" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Error al cargar usuarios")).toBeInTheDocument();
    });
  });

  it("pre-selects given value", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          usuarios: [
            { id: "user-1", email: "ana@test.com" },
            { id: "user-2", email: "luis@test.com" },
          ],
        }),
      })
    ) as jest.Mock;

    render(<ResponsableSelect value="user-2" onChange={jest.fn()} />);

    await waitFor(() => {
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("user-2");
    });
  });
});
