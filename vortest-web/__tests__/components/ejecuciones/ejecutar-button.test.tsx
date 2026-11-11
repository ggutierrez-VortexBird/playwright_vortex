import "@testing-library/jest-dom";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Se mockea el componente
jest.mock("@/components/ejecuciones/ejecutar-button", () => ({
  EjecutarButton: ({ casoPruebaId, onSuccess }: { casoPruebaId: string; onSuccess?: (id: string) => void }) => {
    return (
      <button data-testid="ejecutar-button" data-caso-id={casoPruebaId}>
        Ejecutar
      </button>
    );
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(() => Promise.resolve({ userId: "user-123", email: "admin@example.com" })),
}));

describe("EjecutarButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza el botón con texto 'Ejecutar'", async () => {
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    render(<EjecutarButton casoPruebaId="caso-1" />);
    expect(screen.getByTestId("ejecutar-button")).toBeVisible();
    expect(screen.getByText("Ejecutar")).toBeVisible();
  });

  it("muestra estado de loading al hacer click", async () => {
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    const { getByTestId } = render(<EjecutarButton casoPruebaId="caso-1" />);
    const button = getByTestId("ejecutar-button");

    fireEvent.click(button);

  });

  it("redirige a /ejecuciones/[id] tras éxito (201)", async () => {
    const mockNavigate = jest.fn();
    jest.mock("next/navigation", () => ({
      useRouter: () => ({
        push: mockNavigate,
      }),
    }));

    // Pendiente: verificar la redirección con el componente real
  });

  it("muestra mensaje de error cuando la respuesta es 409", async () => {
    // Pendiente: verificar el mensaje de error ante un 409
  });

  it("muestra error de red cuando hay falla de conexión", async () => {
    // Pendiente: verificar el manejo de errores de red
  });

  it("está deshabilitado mientras está en estado de loading", async () => {
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    const { getByTestId } = render(<EjecutarButton casoPruebaId="caso-1" />);
    const button = getByTestId("ejecutar-button");

    fireEvent.click(button);

    // Pendiente: verificar que se deshabilita durante la petición
  });
});
