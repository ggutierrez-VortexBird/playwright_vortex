import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";

const mockAction = jest.fn();

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders email and password inputs", () => {
    render(<LoginForm action={mockAction} />);
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("displays error message when action returns error", async () => {
    mockAction.mockResolvedValue({ error: "Credenciales inválidas" });
    render(<LoginForm action={mockAction} />);

    const emailInput = screen.getByLabelText(/correo/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole("button", { name: /iniciar sesión/i });

    fireEvent.change(emailInput, { target: { value: "bad@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });
  });

  it("has required attributes on inputs", () => {
    render(<LoginForm action={mockAction} />);
    expect(screen.getByLabelText(/correo/i)).toHaveAttribute("required");
    expect(screen.getByLabelText(/contraseña/i)).toHaveAttribute("required");
  });

  it("renders hidden from input when callbackUrl is provided", () => {
    render(<LoginForm action={mockAction} callbackUrl="/proyectos" />);
    const fromInput = screen.getByDisplayValue("/proyectos");
    expect(fromInput).toHaveAttribute("type", "hidden");
    expect(fromInput).toHaveAttribute("name", "from");
  });
});
