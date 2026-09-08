/**
 * Tests for app/(dashboard)/casos/casos-client.tsx (HU-G20).
 *
 * Verifica que:
 *   - El botón único "Nuevo caso" reemplaza a los anteriores "Grabar caso" y "+ Nuevo Caso".
 *   - Click en "Nuevo caso" abre el ModeSelectorModal.
 *   - El evento 'acta:open-create-caso-form' abre el CreateCasoForm.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { CasosClient } from "@/app/(dashboard)/casos/casos-client";
import type { CasoPruebaListItem } from "@/types/caso";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const mockCasos: CasoPruebaListItem[] = [
  {
    id: "caso-1",
    proyectoId: "proy-1",
    proyectoNombre: "Proyecto A",
    codigo: "CP-01",
    nombre: "Login test",
    scriptFileName: "login.spec.ts",
    responsableId: "user-1",
    responsableEmail: "qa@test.com",
    estado: "sin ejecuciones",
    activo: true,
    fechaUltimaEjecucion: null,
    pasosCount: 3,
    ultimaEjecucionId: null,
    primerPasoFallidoNumero: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

describe("CasosClient (HU-G20 mode selector)", () => {
  it("renderiza el botón único 'Nuevo caso' en lugar de los dos anteriores", () => {
    render(<CasosClient casosIniciales={mockCasos} canEdit={true} />);

    // Botón nuevo
    expect(screen.getByTestId("nuevo-caso-button")).toBeInTheDocument();
    expect(screen.getByText(/Nuevo caso/)).toBeInTheDocument();

    // Botones viejos NO deben existir
    expect(screen.queryByText(/^\+ Nuevo Caso$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Grabar caso")).not.toBeInTheDocument();
  });

  it("NO renderiza el botón 'Nuevo caso' si canEdit=false", () => {
    render(<CasosClient casosIniciales={mockCasos} canEdit={false} />);
    expect(screen.queryByTestId("nuevo-caso-button")).not.toBeInTheDocument();
  });

  it("click en 'Nuevo caso' abre el ModeSelectorModal", () => {
    render(<CasosClient casosIniciales={mockCasos} canEdit={true} />);

    // Inicialmente el modal no está abierto
    expect(screen.queryByTestId("mode-selector-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("nuevo-caso-button"));

    expect(screen.getByTestId("mode-selector-modal")).toBeInTheDocument();
    expect(screen.getByText("Grabar Acción (No-Code)")).toBeInTheDocument();
    expect(screen.getByText("Subir Script Playwright")).toBeInTheDocument();
  });

  it("el evento 'acta:open-create-caso-form' abre el CreateCasoForm", async () => {
    render(<CasosClient casosIniciales={mockCasos} canEdit={true} />);

    // El form no está visible inicialmente
    expect(
      screen.queryByRole("heading", { level: 2, name: /Nuevo Caso de Prueba/ }),
    ).not.toBeInTheDocument();

    // Disparar el evento global (como hace el mode-selector al click en Subir)
    act(() => {
      window.dispatchEvent(new CustomEvent("acta:open-create-caso-form"));
    });

    // Ahora el CreateCasoForm debe estar montado
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /Nuevo Caso de Prueba/,
        }),
      ).toBeInTheDocument();
    });
  });
});
