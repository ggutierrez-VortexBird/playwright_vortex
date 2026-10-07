/**
 * GET  /api/credenciales → lista sin el valor cifrado (superadmin).
 * POST /api/credenciales → { proyectoId, nombre, storageState, vence? } → 201 { id }.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/http/with-auth";
import { crearCredencial, listarCredenciales } from "@/lib/credenciales/gestion";

export const GET = withAuth(async (_request, _context, session) => {
  return NextResponse.json(await listarCredenciales(session));
});

export const POST = withAuth(async (request, _context, session) => {
  const body = await request.json().catch(() => null);
  return NextResponse.json(await crearCredencial(session, body), { status: 201 });
});
