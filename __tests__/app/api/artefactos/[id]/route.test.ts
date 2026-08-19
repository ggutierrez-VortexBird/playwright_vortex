// __tests__/app/api/artefactos/[id]/route.test.ts
// Tests for HU-4.2 — GET /api/artefactos/[id] streaming with auth

import { GET } from "@/app/api/artefactos/[id]/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as fs from "fs";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    artefacto: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

describe("GET /api/artefactos/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "art-1" }) }
    );

    expect(res.status).toBe(401);
  });

  it("retorna 404 cuando el artefacto no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.artefacto.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "art-inexistente" }) }
    );

    expect(res.status).toBe(404);
  });

  it("retorna 404 cuando el archivo físico no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.artefacto.findUnique as jest.Mock).mockResolvedValue({
      id: "art-1",
      path: "/storage/artefactos/ejec-1/video.webm",
      tipo: "video",
    });
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "art-1" }) }
    );

    expect(res.status).toBe(404);
  });

  it("retorna 200 con Content-Type video/webm para artefactos de video", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.artefacto.findUnique as jest.Mock).mockResolvedValue({
      id: "art-1",
      path: "/storage/artefactos/ejec-1/video.webm",
      tipo: "video",
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const streamMock = { pipe: jest.fn() };
    (fs.createReadStream as jest.Mock).mockReturnValue(streamMock);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "art-1" }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("video/webm");
    expect(fs.createReadStream).toHaveBeenCalledWith("/storage/artefactos/ejec-1/video.webm");
  });

  it("retorna 200 con Content-Type image/png para capturas", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.artefacto.findUnique as jest.Mock).mockResolvedValue({
      id: "art-2",
      path: "/storage/artefactos/ejec-1/screenshot.png",
      tipo: "captura",
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const streamMock = { pipe: jest.fn() };
    (fs.createReadStream as jest.Mock).mockReturnValue(streamMock);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "art-2" }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
