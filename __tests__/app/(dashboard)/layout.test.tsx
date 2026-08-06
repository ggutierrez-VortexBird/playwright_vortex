import { render, screen } from "@testing-library/react";
import DashboardLayout from "@/app/(dashboard)/layout";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    await expect(DashboardLayout({ children: <div>Content</div> })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when user not found in DB", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(DashboardLayout({ children: <div>Content</div> })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders layout when session and user are valid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1", email: "admin@admin.com" });
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "admin@admin.com",
      rol: "superadmin",
    });

    const jsx = await DashboardLayout({ children: <div data-testid="content">Content</div> });
    render(jsx);

    expect(screen.getByText("Acta")).toBeInTheDocument();
    expect(screen.getByText("admin@admin.com")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
