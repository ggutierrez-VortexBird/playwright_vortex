import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { middleware } from "@/middleware";

jest.mock("next/server", () => ({
  NextRequest: class {
    url: string;
    nextUrl: { pathname: string; searchParams: URLSearchParams; href: string };
    cookies: { get: jest.Mock };

    constructor(input: string) {
      const url = new URL(input);
      this.url = input;
      this.nextUrl = {
        pathname: url.pathname,
        searchParams: url.searchParams,
        href: url.href,
      };
      this.cookies = { get: jest.fn() };
    }
  },
  NextResponse: {
    next: jest.fn(() => ({ type: "next" })),
    redirect: jest.fn((url: string) => ({ type: "redirect", url })),
  },
}));

jest.mock("iron-session", () => ({
  getIronSession: jest.fn(),
}));

describe("middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should redirect to /login when no session on protected route", async () => {
    (getIronSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new NextRequest("http://localhost/proyectos") as unknown as NextRequest;
    await middleware(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("should allow access when session exists on protected route", async () => {
    (getIronSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    const req = new NextRequest("http://localhost/proyectos") as unknown as NextRequest;
    await middleware(req);

    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("should redirect to / when accessing /login with active session", async () => {
    (getIronSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    const req = new NextRequest("http://localhost/login") as unknown as NextRequest;
    await middleware(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/");
  });

  it("should allow access to /login without session", async () => {
    (getIronSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new NextRequest("http://localhost/login") as unknown as NextRequest;
    await middleware(req);

    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should preserve original URL in callback param when redirecting to login", async () => {
    (getIronSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new NextRequest("http://localhost/proyectos") as unknown as NextRequest;
    await middleware(req);

    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.searchParams.get("from")).toBe("/proyectos");
  });
});
