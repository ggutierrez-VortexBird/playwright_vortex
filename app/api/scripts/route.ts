import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

/**
 * List .spec.ts and .test.ts files in a directory (non-recursive).
 * Returns paths relative to the given root.
 */
async function listScriptFiles(dir: string, root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".test.ts"))
      )
      .map((entry) => {
        const relativePath = path.relative(root, path.join(dir, entry.name));
        // Normalize to POSIX separators for consistency
        return relativePath.replace(/\\/g, "/");
      });
    return results.sort();
  } catch (err) {
    const errorCode = (err as NodeJS.ErrnoException)?.code;
    // ENOENT means directory doesn't exist yet — return empty array
    if (errorCode === "ENOENT") {
      return [];
    }
    throw err;
  }
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const proyectoId = url.searchParams.get("proyectoId");

  if (!proyectoId || typeof proyectoId !== "string") {
    return NextResponse.json(
      { error: "validation", message: "proyectoId is required" },
      { status: 400 }
    );
  }

  // Sanitize proyectoId to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(proyectoId)) {
    return NextResponse.json(
      { error: "validation", message: "proyectoId inválido" },
      { status: 400 }
    );
  }

  const root =
    process.env.PLAYWRIGHT_SCRIPTS_ROOT ?? "/app/playwright-scripts";
  const proyectoDir = path.join(root, proyectoId);

  // Ensure the resolved path stays within root (prevent traversal)
  const resolvedDir = path.resolve(proyectoDir);
  const resolvedRoot = path.resolve(root);
  if (!resolvedDir.startsWith(resolvedRoot)) {
    return NextResponse.json(
      { error: "validation", message: "proyectoId inválido" },
      { status: 400 }
    );
  }

  try {
    const scripts = await listScriptFiles(proyectoDir, root);
    return NextResponse.json({ scripts });
  } catch {
    return NextResponse.json(
      { error: "Error al listar scripts" },
      { status: 500 }
    );
  }
}
