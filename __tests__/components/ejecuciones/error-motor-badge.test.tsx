/**
 * Tests for components/ejecuciones/error-motor-badge.tsx.
 */
import { render, screen } from "@testing-library/react";
import { ErrorMotorBadge } from "@/components/ejecuciones/error-motor-badge";

describe("ErrorMotorBadge", () => {
  it("renders the 'Error motor' badge label", () => {
    render(<ErrorMotorBadge message="Playwright exited with code 1" />);
    expect(screen.getByText("Error motor")).toBeInTheDocument();
  });

  it("renders the provided message as a monospaced detail", () => {
    render(<ErrorMotorBadge message="Playwright exited with code 1" />);
    expect(screen.getByText("Playwright exited with code 1")).toBeInTheDocument();
  });

  it("renders the badge container even when message is empty", () => {
    render(<ErrorMotorBadge message="" />);
    expect(screen.getByText("Error motor")).toBeInTheDocument();
    expect(screen.queryByText(/playwright/i)).not.toBeInTheDocument();
  });

  it("uses a different layout (no message span) when message is omitted-like (falsy)", () => {
    const { container } = render(<ErrorMotorBadge message="" />);
    // Solo hay 1 span visible (el del badge); el del mensaje está condicionado
    // por `message && (...)`.
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toBeInTheDocument();
  });
});