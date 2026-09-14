import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "@/app/(dashboard)/layout";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  getUsuarioActual: jest.fn(),
}));

jest.mock("@/lib/espacios/actions", () => ({
  listEspacios: jest.fn(),
  getEspacioById: jest.fn(),
}));

jest.mock("@/lib/proyectos/actions", () => ({
  listProyectosActivos: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSelectedLayoutSegments: jest.fn(() => []),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    await expect(DashboardLayout({ children: <div>Content</div>, params: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when user not found in DB", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (getUsuarioActual as jest.Mock).mockResolvedValue(null);

    await expect(DashboardLayout({ children: <div>Content</div>, params: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders layout with all nav items when session and user are superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1", email: "admin@admin.com" });
    (getUsuarioActual as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "admin@admin.com",
      rol: "superadmin",
    });
    (listEspacios as jest.Mock).mockResolvedValue([
      { id: "espacio-1", nombre: "Espacio 1", color: "#ff0000", activo: true },
    ]);
    (getEspacioById as jest.Mock).mockResolvedValue(null);
    (listProyectosActivos as jest.Mock).mockResolvedValue([]);

    const jsx = await DashboardLayout({ children: <div data-testid="content">Content</div>, params: Promise.resolve({}) });
    render(jsx);

    fireEvent.click(screen.getByLabelText("Menú de usuario"));
    expect(screen.getByText("admin@admin.com")).toBeInTheDocument();
    expect(screen.getAllByText("Superadmin").length).toBeGreaterThan(0);
    expect(screen.getByTestId("content")).toBeInTheDocument();
    // superadmin ve los 6 ítems, incluyendo Credenciales y Usuarios
    expect(screen.getByText("Credenciales")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Espacios")).toBeInTheDocument();
  });

  it("hides Espacios, Credenciales and Usuarios from the nav for a tester", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-2", email: "tester@example.com" });
    (getUsuarioActual as jest.Mock).mockResolvedValue({
      id: "user-2",
      email: "tester@example.com",
      rol: "tester",
    });
    (listEspacios as jest.Mock).mockResolvedValue([]);
    (getEspacioById as jest.Mock).mockResolvedValue(null);
    (listProyectosActivos as jest.Mock).mockResolvedValue([]);

    const jsx = await DashboardLayout({ children: <div data-testid="content">Content</div>, params: Promise.resolve({}) });
    render(jsx);

    expect(screen.queryByText("Espacios")).not.toBeInTheDocument();
    expect(screen.queryByText("Credenciales")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.getByText("Proyectos")).toBeInTheDocument();
    expect(screen.getByText("Casos")).toBeInTheDocument();
  });
});
