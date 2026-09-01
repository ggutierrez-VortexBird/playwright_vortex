import { render, screen, fireEvent } from "@testing-library/react";
import { NuevaGrabacionForm } from "@/components/grabador/nueva-grabacion-form";
import type { CredencialListItem } from "@/lib/grabador/types";

// next/navigation: stub useRouter since the form calls router.back()
// and router.push() on success.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const baseCredenciales: CredencialListItem[] = [
  { id: "cred-1", nombre: "Admin QA", tipo: "userPass", vence: null },
  { id: "cred-2", nombre: "User Test 1", tipo: "userPass", vence: null },
];

describe("NuevaGrabacionForm", () => {
  it("renders the main heading and form fields", () => {
    render(
      <NuevaGrabacionForm
        proyectoId="proyecto-1"
        credenciales={baseCredenciales}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Configuración de Grabación" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del Caso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/URL Inicial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ambiente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Credencial/i)).toBeInTheDocument();
  });

  it("renders the https:// prefix on the URL field", () => {
    render(
      <NuevaGrabacionForm
        proyectoId="proyecto-1"
        credenciales={baseCredenciales}
      />,
    );
    expect(screen.getByText("https://")).toBeInTheDocument();
  });

  it("renders the 3 browser options with Chromium checked by default", () => {
    render(
      <NuevaGrabacionForm
        proyectoId="proyecto-1"
        credenciales={baseCredenciales}
      />,
    );
    expect(screen.getByTestId("browser-chromium")).toBeInTheDocument();
    expect(screen.getByTestId("browser-firefox")).toBeInTheDocument();
    expect(screen.getByTestId("browser-webkit")).toBeInTheDocument();
    // Chromium radio is checked
    expect(
      screen.getByDisplayValue("chromium") as HTMLInputElement,
    ).toBeChecked();
  });

  it("renders the Cancelar and Iniciar Grabador buttons", () => {
    render(
      <NuevaGrabacionForm
        proyectoId="proyecto-1"
        credenciales={baseCredenciales}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Cancelar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Iniciar Grabador/i }),
    ).toBeInTheDocument();
  });

  it("shows the 'login manual' sentinel when no credenciales exist", () => {
    render(
      <NuevaGrabacionForm proyectoId="proyecto-1" credenciales={[]} />,
    );
    expect(
      screen.getByRole("option", { name: "Ninguna (Login manual)" }),
    ).toBeInTheDocument();
  });

  it("shows validation error when submitting with empty name", async () => {
    render(
      <NuevaGrabacionForm
        proyectoId="proyecto-1"
        credenciales={baseCredenciales}
      />,
    );
    fireEvent.click(screen.getByTestId("start-recording"));
    expect(
      await screen.findByTestId("form-error"),
    ).toHaveTextContent(/nombre del caso es requerido/i);
  });
});
