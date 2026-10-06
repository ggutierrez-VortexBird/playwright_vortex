import { POST } from "@/app/api/logout/route";
import { getIronSession } from "iron-session";

const mockDestroy = jest.fn();

jest.mock("iron-session", () => ({
  getIronSession: jest.fn(() =>
    Promise.resolve({
      destroy: mockDestroy,
    })
  ),
}));

// Mock Request/Response for jsdom environment
global.Request = class Request {
  url: string;
  method: string;
  constructor(input: string, init?: { method?: string }) {
    this.url = input;
    this.method = init?.method || "GET";
  }
} as unknown as typeof Request;

global.Response = class Response {
  status: number;
  headers: Headers;
  constructor(body: null, init?: { status?: number; headers?: Record<string, string> }) {
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers);
  }
} as unknown as typeof Response;

describe("POST /api/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should destroy session and redirect to /login", async () => {
    const req = new Request("http://localhost/api/logout", { method: "POST" });
    const res = await POST(req as unknown as Request);

    expect(getIronSession).toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/login");
  });
});
