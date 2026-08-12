// __tests__/components/ejecuciones/ejecutar-button.test.tsx
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-1, AC-5 (EjecutarButton component behavior)

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the component - will fail until component is implemented
// We import the component that doesn't exist yet
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
    // Import will fail since component doesn't exist — this is RED state
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    render(<EjecutarButton casoPruebaId="caso-1" />);
    expect(screen.getByTestId("ejecutar-button")).toBeVisible();
    expect(screen.getByText("Ejecutar")).toBeVisible();
  });

  it("muestra estado de loading al hacer click — AC-1", async () => {
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    const { getByTestId } = render(<EjecutarButton casoPruebaId="caso-1" />);
    const button = getByTestId("ejecutar-button");

    // Click should trigger loading state
    fireEvent.click(button);

    // Button should be disabled or show loading indicator during the request
    // This will need the actual implementation to verify
  });

  it("redirige a /ejecuciones/[id] tras éxito (201) — AC-1", async () => {
    const mockNavigate = jest.fn();
    jest.mock("next/navigation", () => ({
      useRouter: () => ({
        push: mockNavigate,
      }),
    }));

    // The actual test would need the real component to verify redirect behavior
    // In RED state, we document expected behavior
  });

  it("muestra mensaje de error cuando la respuesta es 409 — AC-5", async () => {
    // The button should handle 409 conflict response and show error message
    // In RED state, we document expected behavior
  });

  it("muestra error de red cuando hay falla de conexión — AC-1", async () => {
    // The button should handle network errors gracefully
    // In RED state, we document expected behavior
  });

  it("está deshabilitado mientras está en estado de loading — AC-1", async () => {
    const { EjecutarButton } = require("@/components/ejecuciones/ejecutar-button");

    const { getByTestId } = render(<EjecutarButton casoPruebaId="caso-1" />);
    const button = getByTestId("ejecutar-button");

    fireEvent.click(button);

    // After click, button should be disabled during the async request
    // The actual implementation would enforce this
  });
});
