import { GET } from "@/app/api/scripts/route";
import { getSession } from "@/lib/auth";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      }),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn(),
  },
}));

import { promises as fs } from "fs";

function makeRequest(url: string) {
  return new Request(url);
}

describe("GET /api/scripts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PLAYWRIGHT_SCRIPTS_ROOT = "/app/playwright-scripts";
  });

  it("returns 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({});
    const res = await GET(makeRequest("http://localhost/api/scripts?proyectoId=abc123"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when proyectoId is missing", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const res = await GET(makeRequest("http://localhost/api/scripts"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("validation");
  });

  it("returns 400 when proyectoId has invalid characters", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const res = await GET(makeRequest("http://localhost/api/scripts?proyectoId=../etc"));
    expect(res.status).toBe(400);
  });

  it("returns empty array when directory does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (fs.readdir as jest.Mock).mockRejectedValue({ code: "ENOENT" });

    const res = await GET(makeRequest("http://localhost/api/scripts?proyectoId=proj1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scripts).toEqual([]);
  });

  it("returns list of .spec.ts and .test.ts files", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: "login.spec.ts", isDirectory: () => false, isFile: () => true },
      { name: "auth", isDirectory: () => true, isFile: () => false },
      { name: "logout.test.ts", isDirectory: () => false, isFile: () => true },
      { name: "readme.md", isDirectory: () => false, isFile: () => true },
    ]);

    const res = await GET(makeRequest("http://localhost/api/scripts?proyectoId=proj1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scripts).toContain("proj1/login.spec.ts");
    expect(data.scripts).toContain("proj1/logout.test.ts");
    expect(data.scripts).not.toContain("proj1/readme.md");
    expect(data.scripts).not.toContain("proj1/auth");
  });
});
