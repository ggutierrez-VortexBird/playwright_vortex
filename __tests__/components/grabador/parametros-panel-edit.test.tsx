/**
 * Tests for components/grabador/parametros-panel.tsx — HU-G12 (edit + sin-uso).
 *
 * Verifies:
 *   - "Sin uso" badge appears when enUso=false
 *   - "Sin uso" badge does NOT appear when enUso=true
 *   - Edit button is hidden when readOnly=true
 *   - Edit button is hidden when param is credential-backed (even in edit mode)
 *   - Edit button shows when readOnly=false AND param is manual
 *   - Save sends PATCH to /api/casos/[casoPruebaId]/parametros/[paramId]
 *   - Save error is rendered
 *   - Cancel returns to read mode without persisting
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParametrosPanel } from "@/components/grabador/parametros-panel";

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      parametro: { id: "p1", nombre: "usuario", valorDefecto: "new", origen: "manual", enUso: true },
    }),
  });
});

const baseParams = [
  {
    id: "p1",
    nombre: "usuario",
    valorDefecto: "admin",
    origen: "manual",
    enUso: true,
  },
];

describe("ParametrosPanel — HU-G12 sin uso badge", () => {
  it("does NOT show sin-uso badge when enUso=true", () => {
    render(<ParametrosPanel parametros={baseParams} />);
    expect(screen.queryByTestId("parametro-sin-uso-usuario")).not.toBeInTheDocument();
    expect(screen.getByTestId("parametro-en-uso")).toBeInTheDocument();
  });

  it("shows sin-uso badge when enUso=false", () => {
    render(
      <ParametrosPanel
        parametros={[
          { id: "p1", nombre: "huérfano", valorDefecto: "x", origen: "manual", enUso: false },
        ]}
      />,
    );
    expect(screen.getByTestId("parametro-sin-uso-huérfano")).toBeInTheDocument();
    expect(screen.queryByTestId("parametro-en-uso")).not.toBeInTheDocument();
  });
});

describe("ParametrosPanel — HU-G12 editable", () => {
  it("hides Edit button when readOnly=true (default)", () => {
    render(<ParametrosPanel parametros={baseParams} casoPruebaId="caso-1" />);
    expect(screen.queryByTestId("parametro-edit-usuario")).not.toBeInTheDocument();
  });

  it("shows Edit button for manual params when readOnly=false", () => {
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    expect(screen.getByTestId("parametro-edit-usuario")).toBeInTheDocument();
  });

  it("does NOT show Edit button for credential params even in edit mode", () => {
    render(
      <ParametrosPanel
        parametros={[
          { id: "p1", nombre: "pwd", valorDefecto: "x", origen: "credencial", enUso: true },
        ]}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    expect(screen.queryByTestId("parametro-edit-pwd")).not.toBeInTheDocument();
  });

  it("clicking Edit reveals an input and Save/Cancel buttons", () => {
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    fireEvent.click(screen.getByTestId("parametro-edit-usuario"));
    expect(screen.getByTestId("parametro-input-usuario")).toBeInTheDocument();
    expect(screen.getByTestId("parametro-save-usuario")).toBeInTheDocument();
    expect(screen.getByTestId("parametro-cancel-usuario")).toBeInTheDocument();
  });

  it("Save PATCHes to /api/casos/[casoPruebaId]/parametros/[paramId]", async () => {
    const onChange = jest.fn();
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-42"
        onParametrosChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("parametro-edit-usuario"));
    const input = screen.getByTestId("parametro-input-usuario");
    fireEvent.change(input, { target: { value: "nuevo-admin" } });
    fireEvent.click(screen.getByTestId("parametro-save-usuario"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-42/parametros/p1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ valorDefecto: "nuevo-admin" }),
        }),
      );
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("renders error message when PATCH fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "DB caído" }),
    });
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    fireEvent.click(screen.getByTestId("parametro-edit-usuario"));
    fireEvent.change(screen.getByTestId("parametro-input-usuario"), {
      target: { value: "z" },
    });
    fireEvent.click(screen.getByTestId("parametro-save-usuario"));

    await waitFor(() => {
      expect(screen.getByTestId("parametro-error-usuario").textContent).toContain(
        "DB caído",
      );
    });
  });

  it("Cancel returns to read mode without calling fetch", async () => {
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    fireEvent.click(screen.getByTestId("parametro-edit-usuario"));
    fireEvent.change(screen.getByTestId("parametro-input-usuario"), {
      target: { value: "no-debe-guardarse" },
    });
    fireEvent.click(screen.getByTestId("parametro-cancel-usuario"));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("parametro-input-usuario")).not.toBeInTheDocument();
    expect(screen.getByTestId("parametro-edit-usuario")).toBeInTheDocument();
  });

  it("envía null cuando el input queda vacío (permite borrar el default)", async () => {
    render(
      <ParametrosPanel
        parametros={baseParams}
        readOnly={false}
        casoPruebaId="caso-1"
      />,
    );
    fireEvent.click(screen.getByTestId("parametro-edit-usuario"));
    fireEvent.change(screen.getByTestId("parametro-input-usuario"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("parametro-save-usuario"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-1/parametros/p1",
        expect.objectContaining({
          body: JSON.stringify({ valorDefecto: null }),
        }),
      );
    });
  });
});