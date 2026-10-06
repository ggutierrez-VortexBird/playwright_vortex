/**
 * Tests for components/ui/logo.tsx.
 */
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/ui/logo";

describe("Logo", () => {
  it("renders the VorTest logo with an accessible name", () => {
    render(<Logo />);
    const img = screen.getByRole("img", { name: "VorTest" });
    expect(img).toBeInTheDocument();
  });

  it("uses the light variant by default (176x61)", () => {
    render(<Logo />);
    const img = screen.getByRole("img", { name: "VorTest" });
    expect(img).toHaveAttribute("width", "176");
    expect(img).toHaveAttribute("height", "61");
  });

  it("uses the dark variant when variant=dark (140x49)", () => {
    render(<Logo variant="dark" />);
    const img = screen.getByRole("img", { name: "VorTest" });
    expect(img).toHaveAttribute("width", "140");
    expect(img).toHaveAttribute("height", "49");
  });

  it("applies the optional className", () => {
    render(<Logo className="custom-class" />);
    const img = screen.getByRole("img", { name: "VorTest" });
    expect(img).toHaveClass("custom-class");
  });
});