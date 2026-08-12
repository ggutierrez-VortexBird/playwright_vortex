import { render, screen } from "@testing-library/react";
import { ScopeBar } from "@/components/ui/scope-bar";

describe("ScopeBar", () => {
  it("renders with proyectoNombre and espacioColor", () => {
    render(
      <ScopeBar
        espacioNombre="Cliente A"
        proyectoNombre="Proyecto 1"
        espacioColor="#ff0000"
      />
    );

    expect(screen.getByText("Cliente A · Proyecto 1")).toBeInTheDocument();
    // Check the color indicator element exists (it's an <i> with aria-hidden)
    const icon = document.querySelector('i[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
  });

  it("renders without color when espacioColor is null", () => {
    render(
      <ScopeBar
        espacioNombre="Cliente A"
        proyectoNombre="Proyecto 1"
      />
    );

    expect(screen.getByText("Cliente A · Proyecto 1")).toBeInTheDocument();
    expect(document.querySelector('i[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("returns null when no proyectoNombre is provided", () => {
    const { container } = render(
      <ScopeBar
        espacioNombre="Cliente A"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("returns null when proyectoNombre is undefined", () => {
    const { container } = render(
      <ScopeBar
        espacioNombre="Cliente A"
        proyectoNombre={undefined}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
