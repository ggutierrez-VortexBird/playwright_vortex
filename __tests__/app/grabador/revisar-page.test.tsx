/**
 * Integration test: /casos/grabar/[sesionId]/revisar — placeholder page.
 *
 * Covers HU-G2 navigation flow: after clicking "Detener y revisar",
 * the user lands here. This test exercises the Server Component layer
 * (auth gate + DB load + ownership check + RevisarPlaceholder render).
 *
 * Cases:
 *   - 404 if session does not exist
 *   - redirect to /casos if session belongs to a different user
 *   - 200 (placeholder renders) when session is owned by the current user
 *
 * The route doesn't take a redirect through iron-session here — it uses
 * `redirect()` from next/navigation which throws a `NEXT_REDIRECT` error.
 * We catch that to assert the redirect target.
 */

import RevisarPage from "@/app/(dashboard)/casos/grabar/[sesionId]/revisar/page";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// next/navigation: mock notFound + redirect
// Use `var` so the bindings are available when jest.mock factory
// (hoisted to the top of the file) references them.
var mockNotFound: jest.Mock;
var mockRedirect: jest.Mock;

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

beforeAll(() => {
  mockNotFound = jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mockRedirect = jest.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  });
});

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
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
});

describe("/casos/grabar/[sesionId]/revisar (server page)", () => {
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
      _count: { pasos: 3 },
    });

    await expect(
      RevisarPage({ params: Promise.resolve({ sesionId: "ses-1" }) }),
    ).rejects.toThrow(/NEXT_REDIRECT: \/casos/);
  });

  it("renders the RevisarPlaceholder when session is owned", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "abcd1234-uuid",
      usuarioId: "user-1",
      _count: { pasos: 7 },
    });

    // RevisarPlaceholder is a Client Component; in this test environment
    // it renders successfully with the props we pass.
    const tree = await RevisarPage({
      params: Promise.resolve({ sesionId: "abcd1234-uuid" }),
    });

    // The result is a React element (RSC) containing the placeholder.
    expect(tree).toBeTruthy();
    expect((tree as { props: unknown }).props).toBeDefined();

    // Verify the page queried the DB with the correct ownership check.
    expect(prisma.sesionGrabacion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "abcd1234-uuid" },
      }),
    );
  });
});
