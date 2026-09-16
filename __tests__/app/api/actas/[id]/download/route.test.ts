// __tests__/app/api/actas/[id]/download/route.test.ts
// Tests for GET /api/actas/[id]/download — PDF streaming with auth.

import { GET } from "@/app/api/actas/[id]/download/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as fs from "node:fs";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    acta: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("node:fs", () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

describe("GET /api/actas/[id]/download", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "acta-1" }) }
    );

    expect(res.status).toBe(401);
  });

  it("retorna 404 cuando el acta no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.acta.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "acta-inexistente" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("retorna 404 con file_missing cuando rutaPdf es null", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.acta.findUnique as jest.Mock).mockResolvedValue({
      id: "acta-1",
      rutaPdf: null,
      consecutivo: "ACE-2026-0001",
    });

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "acta-1" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("file_missing");
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it("retorna 404 con file_missing cuando el archivo físico no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.acta.findUnique as jest.Mock).mockResolvedValue({
      id: "acta-1",
      rutaPdf: "/storage/actas/acta-1.pdf",
      consecutivo: "ACE-2026-0001",
    });
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "acta-1" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("file_missing");
  });

  it("retorna 200 con Content-Type application/pdf y Content-Disposition inline", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.acta.findUnique as jest.Mock).mockResolvedValue({
      id: "acta-1",
      rutaPdf: "/storage/actas/acta-1.pdf",
      consecutivo: "ACE-2026-0042",
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const streamMock = { pipe: jest.fn() };
    (fs.createReadStream as jest.Mock).mockReturnValue(streamMock);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "acta-1" }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      'inline; filename="acta-ACE-2026-0042.pdf"'
    );
    expect(fs.createReadStream).toHaveBeenCalledWith("/storage/actas/acta-1.pdf");
  });
});
