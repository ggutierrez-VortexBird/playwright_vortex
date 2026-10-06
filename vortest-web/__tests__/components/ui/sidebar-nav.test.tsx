/**
 * Tests for components/ui/sidebar-nav.tsx.
 */
import { render, screen } from "@testing-library/react";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";

jest.mock("next/navigation", () => ({
  useSelectedLayoutSegments: () => ["casos"],
  usePathname: () => "/casos",
}));

const items: SidebarNavItem[] = [
  { href: "/casos", label: "Casos", icon: "fact_check" },
  { href: "/proyectos", label: "Proyectos", icon: "folder" },
  { href: "/ejecuciones", label: "Ejecuciones", icon: "play_arrow" },
];

describe("SidebarNav", () => {
  it("renders a link per item with the correct href", () => {
    render(<SidebarNav items={items} />);
    expect(screen.getByRole("link", { name: /Casos/ })).toHaveAttribute("href", "/casos");
    expect(screen.getByRole("link", { name: /Proyectos/ })).toHaveAttribute("href", "/proyectos");
    expect(screen.getByRole("link", { name: /Ejecuciones/ })).toHaveAttribute("href", "/ejecuciones");
  });

  it("renders the icon span per item", () => {
    render(<SidebarNav items={items} />);
    expect(screen.getByText("fact_check")).toBeInTheDocument();
    expect(screen.getByText("folder")).toBeInTheDocument();
    expect(screen.getByText("play_arrow")).toBeInTheDocument();
  });

  it("marks the active item with aria-current='true'", () => {
    render(<SidebarNav items={items} />);
    expect(screen.getByRole("link", { name: /Casos/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Proyectos/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Ejecuciones/ })).not.toHaveAttribute("aria-current");
  });
});