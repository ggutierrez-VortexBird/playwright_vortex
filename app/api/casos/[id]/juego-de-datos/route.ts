/**
 * GET /api/casos/[id]/juego-de-datos
 *
 * Lista los JuegoDeDatos del caso (el más reciente primero).
 *
 * Responses:
 *   - 200 { juegos: [{ id, nombreArchivo, filas, createdAt }] }
 *   - 401 { error: 'No autenticado' }
 *   - 404 { error: 'not_found' }
 *
 * POST /api/casos/[id]/juego-de-datos
 *
 * Sube un CSV data-driven (HU-G13).
 *
 * Body: multipart/form-data con campo `archivo` (text/csv).
 *
 * Validación:
 *   - Las columnas del CSV deben matchear EXACTAMENTE los nombres de
 *     ParametroGrabacion del caso (error claro si falta/sobra).
 *   - Header row obligatorio.
 *
 * Reemplaza el juego de datos anterior (1-a-1 con CasoPrueba en MVP;
 * si hay varios, los borramos todos antes de crear el nuevo).
 *
 * Responses:
 *   - 201 { juego: { id, nombreArchivo, filas, createdAt }, headers, previewRows }
 *   - 400 { error: 'validation', message } / { error: 'csv_validation', errors, message }
 *   - 401 { error: 'No autenticado' }
 *   - 404 { error: 'not_found' }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsearCsv } from "@/lib/grabador/csv-validator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: casoPruebaId } = await params;

  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
    select: { id: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const juegos = await prisma.juegoDeDatos.findMany({
    where: { casoPruebaId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombreArchivo: true,
      filas: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ juegos });
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB MVP

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: casoPruebaId } = await params;

  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
    select: { id: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "validation", message: "Body debe ser multipart/form-data" },
      { status: 400 },
    );
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: "validation", message: "Falta el campo 'archivo'" },
      { status: 400 },
    );
  }
  if (archivo.size === 0) {
    return NextResponse.json(
      { error: "validation", message: "El archivo está vacío" },
      { status: 400 },
    );
  }
  if (archivo.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: "validation",
        message: `Archivo demasiado grande (${archivo.size} bytes > ${MAX_FILE_BYTES} bytes)`,
      },
      { status: 400 },
    );
  }

  const texto = await archivo.text();
  const nombreArchivo = archivo.name || "data.csv";

  // Load param names for validation.
  const parametros = await prisma.parametroGrabacion.findMany({
    where: { casoPruebaId },
    select: { nombre: true },
    orderBy: { nombre: "asc" },
  });
  const expectedHeaders = parametros.map((p) => p.nombre);

  const resultado = parsearCsv(texto, expectedHeaders);

  if (!resultado.ok) {
    const isColumns = resultado.errors.some(
      (e) => e.type === "missing_column" || e.type === "extra_column",
    );
    const message = isColumns
      ? resultado.errors.map((e) => e.message).join("; ")
      : resultado.errors[0]?.message ?? "CSV inválido";
    return NextResponse.json(
      {
        error: "csv_validation",
        message,
        errors: resultado.errors,
      },
      { status: 400 },
    );
  }

  // Replace any existing juego de datos (1-a-1 in MVP).
  await prisma.juegoDeDatos.deleteMany({ where: { casoPruebaId } });

  const juego = await prisma.juegoDeDatos.create({
    data: {
      casoPruebaId,
      nombreArchivo,
      filas: resultado.filas as unknown as object,
    },
    select: {
      id: true,
      nombreArchivo: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      juego: {
        id: juego.id,
        nombreArchivo: juego.nombreArchivo,
        filas: resultado.filas,
        createdAt: juego.createdAt.toISOString(),
      },
      headers: resultado.headers,
      previewRows: resultado.filas.slice(0, 5),
    },
    { status: 201 },
  );
}