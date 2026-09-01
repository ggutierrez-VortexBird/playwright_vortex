/**
 * Integration test: /casos/grabar/[sesionId]/revisar (HU-G8).
 *
 * Verifies the Server Component layer (auth gate + DB load + ownership
 * check + RevisarCliente render). The full drag-and-drop UI is exercised
 * in `__tests__/components/grabador/revisar-cliente.test.tsx`.
 */

import RevisarPage from "@/app/(dashboard)/casos/grabar/[sesionId]/revisar/page";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("next/navigation", () => ({
  __esModule: true,
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: jest.fn(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("/casos/grabar/[sesionId]/revisar (server page, HU-G8)", () => {
  it("redirects to /login when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    await expect(
      RevisarPage({ params: Promise.resolve({ sesionId: "ses-1" }) }),
    ).rejects.toThrow(/NEXT_REDIRECT: \/login/);
  });

  it("throws 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      RevisarPage({ params: Promise.resolve({ sesionId: "ses-x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("redirects to /casos when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
      nombre: "X",
      pasos: [],
      parametros: [],
    });
    await expect(
      RevisarPage({ params: Promise.resolve({ sesionId: "ses-1" }) }),
    ).rejects.toThrow(/NEXT_REDIRECT: \/casos/);
  });

  it("renders with empty pasos/parametros when session has none", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      nombre: "Sesión vacía",
      pasos: [],
      parametros: [],
    });
    const tree = await RevisarPage({
      params: Promise.resolve({ sesionId: "ses-1" }),
    });
    expect(tree).toBeTruthy();
    expect(prisma.sesionGrabacion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ses-1" },
      }),
    );
  });

  it("loads pasos + parametros in the expected shapes", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      nombre: "Consulta de saldo",
      pasos: [
        {
          id: "p1",
          numero: 1,
          tipo: "navegar",
          descripcion: "Abrir portal",
          selectorPrincipal: null,
          selectoresRespaldo: null,
          valor: null,
          esValorSensible: false,
          assertionKind: null,
        },
      ],
      parametros: [
        {
          id: "param1",
          nombre: "usuario",
          valorDefecto: "admin",
          origen: "manual",
          enUso: true,
        },
      ],
    });

    const tree = await RevisarPage({
      params: Promise.resolve({ sesionId: "ses-1" }),
    });
    expect(tree).toBeTruthy();
    // Verify the DB query was made with the right select fields.
    const call = (prisma.sesionGrabacion.findUnique as jest.Mock).mock
      .calls[0][0];
    expect(call.select.pasos.select).toHaveProperty("id");
    expect(call.select.parametros.select).toHaveProperty("valorDefecto");
  });
});
