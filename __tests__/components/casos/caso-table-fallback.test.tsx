// __tests__/components/casos/caso-table-fallback.test.tsx
// RED test — for the crash fix in components/casos/caso-table.tsx
//
// getEstadoPill() has a closed map of 5 states, but returns undefined for any
// other value. Reading .classes on the undefined result crashes the table.
// This test verifies the fallback path keeps the row renderable.

import { render } from "@testing-library/react";
import { CasoTable } from "@/components/casos/caso-table";
import type { CasoPruebaListItem } from "@/types/caso";

describe("CasoTable — fallback when estado is not in the pill map", () => {
  it("does not crash when estado is an unknown value (pendiente)", () => {
    const casoConEstadoRaro: CasoPruebaListItem = {
      id: "caso-x",
      proyectoId: "proyecto-x",
      proyectoNombre: "Proyecto X",
      codigo: "CP-X-01",
      nombre: "Caso con estado raro",
      scriptFileName: null,
      responsableId: "user-x",
      responsableEmail: "x@y.z",
      // Bypass the discriminated-union guard so we can simulate an
      // unexpected estado value coming through from the API/DB.
      estado: "pendiente" as CasoPruebaListItem["estado"],
      activo: true,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-05T00:00:00Z",
      fechaUltimaEjecucion: null,
      pasosCount: 0,
      ultimaEjecucionId: null,
      primerPasoFallidoNumero: null,
    };

    expect(() => render(<CasoTable casos={[casoConEstadoRaro]} />)).not.toThrow();
  });

  it("does not crash when estado is an unknown value (corriendo)", () => {
    const casoConEstadoRaro: CasoPruebaListItem = {
      id: "caso-y",
      proyectoId: "proyecto-y",
      proyectoNombre: "Proyecto Y",
      codigo: "CP-Y-01",
      nombre: "Caso corriendo",
      scriptFileName: null,
      responsableId: "user-y",
      responsableEmail: "y@y.z",
      estado: "corriendo" as CasoPruebaListItem["estado"],
      activo: true,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-05T00:00:00Z",
      fechaUltimaEjecucion: null,
      pasosCount: 0,
      ultimaEjecucionId: null,
      primerPasoFallidoNumero: null,
    };

    expect(() => render(<CasoTable casos={[casoConEstadoRaro]} />)).not.toThrow();
  });
});
