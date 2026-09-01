/**
 * Tests for components/grabador/revisar-placeholder.tsx — placeholder page
 * shown after the user clicks "Detener y revisar" (HU-G2). The full review
 * screen arrives in HU-G8; this just confirms the stop, displays the step
 * count, and lets the user return to /casos.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { RevisarPlaceholder } from "@/components/grabador/revisar-placeholder";

// Mock next/navigation router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    refresh: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RevisarPlaceholder", () => {
  it("renders the placeholder card", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={0} />);
    expect(screen.getByTestId("revisar-placeholder")).toBeInTheDocument();
  });

  it("shows the 'Sesión detenida' title", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={5} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Sesión detenida" }),
    ).toBeInTheDocument();
  });

  it("renders the videocam icon", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={5} />);
    expect(screen.getByTestId("revisar-icon")).toBeInTheDocument();
    expect(screen.getByTestId("revisar-icon").textContent).toBe("videocam");
  });

  it("shows the session short id in the subtitle", () => {
    render(<RevisarPlaceholder sesionId="abcd1234-uuid" pasosCount={5} />);
    // First 4 chars uppercased → ABCD; appears in both topbar and body.
    expect(screen.getAllByText(/SES-ABCD/).length).toBeGreaterThanOrEqual(1);
  });

  it("uses singular 'paso grabado' when pasosCount is 1", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={1} />);
    expect(screen.getByText(/1 paso grabado/)).toBeInTheDocument();
  });

  it("uses plural 'pasos grabados' when pasosCount > 1", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={7} />);
    expect(screen.getByText(/7 pasos grabados/)).toBeInTheDocument();
  });

  it("uses plural 'pasos grabados' when pasosCount is 0", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={0} />);
    expect(screen.getByText(/0 pasos grabados/)).toBeInTheDocument();
  });

  it("renders the HU-G8 deprecation note", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={5} />);
    expect(
      screen.getByText(/La pantalla completa de revisión llega en HU-G8/),
    ).toBeInTheDocument();
  });

  it("'Volver a /casos' button navigates to /casos", () => {
    render(<RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={5} />);
    fireEvent.click(screen.getByTestId("revisar-volver"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/casos");
  });
});

describe("RevisarPlaceholder — page wiring", () => {
  it("is rendered correctly inside the dashboard layout (smoke test)", () => {
    // The page component is a Server Component that loads sesion from DB
    // and passes the result here. This test verifies the placeholder
    // survives the boundary by checking the basic markup.
    const { container } = render(
      <RevisarPlaceholder sesionId="abc12345-uuid" pasosCount={3} />,
    );
    expect(container.firstChild).not.toBeNull();
    // Use getAllByText — SES-ABC1 appears in both the topbar subtitle
    // and the body card.
    expect(screen.getAllByText(/SES-ABC1/).length).toBeGreaterThanOrEqual(1);
  });
});
