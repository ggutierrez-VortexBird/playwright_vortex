import { render, screen } from "@testing-library/react";
import CasosPage from "@/app/(dashboard)/casos/page";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCasos } from "@/lib/casos/actions";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
    proyecto: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/casos/actions", () => ({
  listCasos: jest.fn(),
}));

jest.mock("@/app/(dashboard)/casos/casos-client", () => ({
  CasosClient: ({ casosIniciales, canEdit, proyectos }: { casosIniciales: any[]; canEdit: boolean; proyectos?: any[] }) => (
    <div data-testid="casos-client">
      <span data-testid="casos-count">{casosIniciales.length}</span>
      <span data-testid="can-edit">{canEdit ? "yes" : "no"}</span>
      {proyectos && <span data-testid="proyectos-count">{proyectos.length}</span>}
    </div>
  ),
}));

describe("CasosPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders CasosClient with casos and canEdit=true for superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1", email: "admin@admin.com" });
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", rol: "superadmin" });
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue([
      { id: "proyecto-1", nombre: "Proyecto Alpha", espacio: { nombre: "Espacio X" }, activo: true },
    ]);
    (listCasos as jest.Mock).mockResolvedValue([
      {
        id: "caso-1",
        proyectoId: "proyecto-1",
        proyectoNombre: "Proyecto Alpha",
        codigo: "CP-01",
        nombre: "Caso A",
        rutaScript: "tests/a.spec.ts",
        responsableId: "user-1",
        responsableEmail: "ana@test.com",
        estado: "paso",
        activo: true,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ]);

    const jsx = await CasosPage();
    render(jsx);

    expect(screen.getByTestId("casos-client")).toBeInTheDocument();
    expect(screen.getByTestId("casos-count")).toHaveTextContent("1");
    expect(screen.getByTestId("can-edit")).toHaveTextContent("yes");
  });

  it("renders CasosClient with canEdit=false for non-superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-2", email: "user@test.com" });
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-2", rol: "usuario" });
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue([]);
    (listCasos as jest.Mock).mockResolvedValue([]);

    const jsx = await CasosPage();
    render(jsx);

    expect(screen.getByTestId("can-edit")).toHaveTextContent("no");
  });
});
