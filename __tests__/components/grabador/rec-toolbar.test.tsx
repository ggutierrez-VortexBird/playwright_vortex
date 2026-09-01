import { render, screen } from "@testing-library/react";
import { RecToolbar } from "@/components/grabador/rec-toolbar";

describe("RecToolbar", () => {
  it("renders all 4 tools", () => {
    render(<RecToolbar />);
    expect(screen.getByTestId("tool-senalar")).toBeInTheDocument();
    expect(screen.getByTestId("tool-verificar")).toBeInTheDocument();
    expect(screen.getByTestId("tool-parametro")).toBeInTheDocument();
    expect(screen.getByTestId("tool-pausar")).toBeInTheDocument();
  });

  it("disables all tools (they are stubs for HU-G5..G7)", () => {
    render(<RecToolbar />);
    expect(screen.getByTestId("tool-senalar")).toBeDisabled();
    expect(screen.getByTestId("tool-verificar")).toBeDisabled();
    expect(screen.getByTestId("tool-parametro")).toBeDisabled();
    expect(screen.getByTestId("tool-pausar")).toBeDisabled();
  });

  it("shows the Señalar elemento label per mockup", () => {
    render(<RecToolbar />);
    expect(screen.getByText("Señalar elemento")).toBeInTheDocument();
  });
});
