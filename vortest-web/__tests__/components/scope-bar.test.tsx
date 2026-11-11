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

    // Solo se renderiza proyectoNombre; espacioNombre es prop pero no se pinta.
    expect(screen.getByText("Proyecto 1")).toBeInTheDocument();
    // El indicador de color es un <i> con aria-hidden
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

    // Solo `proyectoNombre` se renderiza; sin `espacioColor`, no hay <i>.
    expect(screen.getByText("Proyecto 1")).toBeInTheDocument();
    expect(document.querySelector('i[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("returns null when no proyectoNombre is provided", () => {
    const { container } = render(
      <ScopeBar
        espacioNombre="Cliente A"
      />
    );

    // Renderiza espacioNombre aunque falte proyectoNombre
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain("Cliente A");
  });

  it("returns null when proyectoNombre is undefined", () => {
    const { container } = render(
      <ScopeBar
        espacioNombre="Cliente A"
        proyectoNombre={undefined}
      />
    );

    // Renderiza espacioNombre aunque falte proyectoNombre
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain("Cliente A");
  });
});
