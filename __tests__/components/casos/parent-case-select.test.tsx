/**
 * Tests for components/casos/parent-case-select.tsx.
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ParentCaseSelect } from "@/components/casos/parent-case-select";

describe("ParentCaseSelect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the 'Ninguno' default option after fetch resolves", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            options: [
              { id: "caso-a", codigo: "CP-A", nombre: "Caso A" },
              { id: "caso-b", codigo: "CP-B", nombre: "Caso B" },
            ],
          }),
      }),
    ) as jest.Mock;

    await act(async () => {
      render(<ParentCaseSelect proyectoId="proy-1" value={null} onChange={jest.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "CP-A — Caso A" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "CP-B — Caso B" })).toBeInTheDocument();
    });

    expect(
      screen.getByRole("option", { name: "Ninguno (caso independiente)" }),
    ).toBeInTheDocument();
  });

  it("calls /api/casos with the correct query params on mount", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ options: [] }) }),
    ) as jest.Mock;

    await act(async () => {
      render(
        <ParentCaseSelect
          proyectoId="proy-42"
          value={null}
          onChange={jest.fn()}
          excludeId="caso-self"
        />,
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("parentOptions=true"),
      );
    });

    const calledWith = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledWith).toContain("proyectoId=proy-42");
    expect(calledWith).toContain("excludeId=caso-self");
  });

  it("calls onChange with the selected case id", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            options: [{ id: "caso-a", codigo: "CP-A", nombre: "Caso A" }],
          }),
      }),
    ) as jest.Mock;

    const onChange = jest.fn();
    await act(async () => {
      render(<ParentCaseSelect proyectoId="proy-1" value={null} onChange={onChange} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "CP-A — Caso A" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "caso-a" } });
    expect(onChange).toHaveBeenCalledWith("caso-a");
  });

  it("calls onChange(null) when 'Ninguno' is selected", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            options: [{ id: "caso-a", codigo: "CP-A", nombre: "Caso A" }],
          }),
      }),
    ) as jest.Mock;

    const onChange = jest.fn();
    await act(async () => {
      render(<ParentCaseSelect proyectoId="proy-1" value="caso-a" onChange={onChange} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "CP-A — Caso A" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("is disabled while options are empty after the fetch resolves", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ options: [] }) }),
    ) as jest.Mock;

    await act(async () => {
      render(<ParentCaseSelect proyectoId="proy-1" value={null} onChange={jest.fn()} />);
    });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await waitFor(() => {
      expect(select).toBeDisabled();
    });
  });

  it("respects the disabled prop", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            options: [{ id: "caso-a", codigo: "CP-A", nombre: "Caso A" }],
          }),
      }),
    ) as jest.Mock;

    await act(async () => {
      render(
        <ParentCaseSelect
          proyectoId="proy-1"
          value={null}
          onChange={jest.fn()}
          disabled
        />,
      );
    });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});