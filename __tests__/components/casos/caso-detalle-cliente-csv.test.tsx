/**
 * Tests for the CSV upload UI in components/casos/caso-detalle-cliente.tsx (HU-G13).
 *
 * Verifies:
 *   - "Subir CSV" button is always rendered.
 *   - File input is hidden (CSS) but accessible via testid.
 *   - Selecting a file POSTs to /api/casos/[id]/juego-de-datos as multipart/form-data.
 *   - On success: shows preview with headers + first 5 rows.
 *   - On CSV validation error (400): renders error message.
 *   - "Quitar" button clears the preview.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const baseCaso = {
  id: "caso-1",
  codigo: "CP-1",
  nombre: "Test",
  script: "// hello",
  scriptFileName: null,
  origen: "subirScript",
  activo: true,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  parametros: [],
};

describe("CasoDetalleCliente — CSV upload (HU-G13)", () => {
  it("renders the Subir CSV button", () => {
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    expect(screen.getByTestId("csv-upload-button")).toBeInTheDocument();
    expect(screen.getByTestId("csv-section")).toBeInTheDocument();
  });

  it("uploads a CSV file via multipart POST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        juego: { id: "jd-1", nombreArchivo: "data.csv" },
        headers: ["user", "amount"],
        previewRows: [
          { user: "alice", amount: "10" },
          { user: "bob", amount: "20" },
        ],
      }),
    });

    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const file = new File(["user,amount\nalice,10\nbob,20\n"], "data.csv", {
      type: "text/csv",
    });
    const input = screen.getByTestId("csv-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-1/juego-de-datos",
        expect.objectContaining({ method: "POST" }),
      );
    });
    // Verify the body is FormData containing the file.
    const call = mockFetch.mock.calls[0];
    const body = call[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("archivo")).toBe(file);
  });

  it("renders preview table with headers + rows on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        juego: { id: "jd-1", nombreArchivo: "caso.csv" },
        headers: ["user", "amount"],
        previewRows: [
          { user: "alice", amount: "10" },
          { user: "bob", amount: "20" },
        ],
      }),
    });

    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const file = new File(["x"], "caso.csv", { type: "text/csv" });
    const input = screen.getByTestId("csv-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("csv-preview")).toBeInTheDocument();
    });
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders csv_validation error message when columns do not match", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "csv_validation",
        message: 'Falta columna "saldo"; Sobra columna "foo"',
        errors: [
          { column: "saldo", message: 'Falta columna "saldo"' },
          { column: "foo", message: 'Sobra columna "foo"' },
        ],
      }),
    });

    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const input = screen.getByTestId("csv-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "data.csv", { type: "text/csv" })] },
    });

    await waitFor(() => {
      const errEl = screen.getByTestId("csv-error");
      expect(errEl.textContent).toContain("saldo");
      expect(errEl.textContent).toContain("foo");
    });
  });

  it('"Quitar" clears the preview', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        juego: { id: "jd-1", nombreArchivo: "data.csv" },
        headers: ["x"],
        previewRows: [{ x: "1" }],
      }),
    });
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const input = screen.getByTestId("csv-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "data.csv", { type: "text/csv" })] },
    });
    await waitFor(() => {
      expect(screen.getByTestId("csv-preview")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("csv-clear-button"));
    expect(screen.queryByTestId("csv-preview")).not.toBeInTheDocument();
  });

  it("upload button is disabled while busy", async () => {
    let resolveUpload: (value: unknown) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const input = screen.getByTestId("csv-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "data.csv", { type: "text/csv" })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("csv-upload-button")).toBeDisabled();
    });
    resolveUpload({
      ok: false,
      status: 500,
      json: async () => ({ message: "x" }),
    });
  });
});