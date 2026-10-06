// __tests__/lib/ejecuciones/chapter-segments.test.ts
// HU-G18 — chapter segmentation tests

import {
  computeChapterSegments,
  findChapterAtTime,
  pasosTienenCapitulosValidos,
  type PasoConCapitulo,
} from "@/lib/ejecuciones/chapter-segments";

function paso(over: Partial<PasoConCapitulo>): PasoConCapitulo {
  return {
    id: over.id ?? "p",
    numero: over.numero ?? 1,
    descripcion: over.descripcion ?? "Paso",
    estado: over.estado ?? "paso",
    duracionMs: over.duracionMs ?? null,
    videoInicioMs: over.videoInicioMs ?? null,
    videoFinMs: over.videoFinMs ?? null,
  };
}

describe("pasosTienenCapitulosValidos", () => {
  it("devuelve false si no hay pasos", () => {
    expect(pasosTienenCapitulosValidos([])).toBe(false);
  });

  it("devuelve false si algún paso no tiene timestamps", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 0, videoFinMs: 1000 }),
      paso({ id: "b", numero: 2, videoInicioMs: null, videoFinMs: null }),
    ];
    expect(pasosTienenCapitulosValidos(pasos)).toBe(false);
  });

  it("devuelve false si los timestamps no son monótonos", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 1000, videoFinMs: 2000 }),
      paso({ id: "b", numero: 2, videoInicioMs: 500, videoFinMs: 600 }),
    ];
    expect(pasosTienenCapitulosValidos(pasos)).toBe(false);
  });

  it("devuelve false si el segmento está invertido", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 200, videoFinMs: 100 }),
    ];
    expect(pasosTienenCapitulosValidos(pasos)).toBe(false);
  });

  it("devuelve true cuando todos los pasos tienen timestamps válidos y monótonos", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 0, videoFinMs: 1000 }),
      paso({ id: "b", numero: 2, videoInicioMs: 1000, videoFinMs: 3000 }),
    ];
    expect(pasosTienenCapitulosValidos(pasos)).toBe(true);
  });
});

describe("computeChapterSegments — modo timestamp (HU-G18 path)", () => {
  it("usa los timestamps absolutos cuando están disponibles", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 0, videoFinMs: 1000 }),
      paso({ id: "b", numero: 2, videoInicioMs: 1000, videoFinMs: 3000 }),
      paso({ id: "c", numero: 3, videoInicioMs: 3000, videoFinMs: 4000 }),
    ];
    const segs = computeChapterSegments(pasos, 4000);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({
      pasoId: "a",
      inicioMs: 0,
      finMs: 1000,
      anchoPct: 25,
    });
    expect(segs[1]).toMatchObject({
      pasoId: "b",
      inicioMs: 1000,
      finMs: 3000,
      anchoPct: 50,
    });
    expect(segs[2]).toMatchObject({
      pasoId: "c",
      inicioMs: 3000,
      finMs: 4000,
      anchoPct: 25,
    });
  });

  it("anchoPct nunca es 0 (mínimo 1%) para evitar segmentos invisibles", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 0, videoFinMs: 1 }),
      paso({ id: "b", numero: 2, videoInicioMs: 1, videoFinMs: 100000 }),
    ];
    const segs = computeChapterSegments(pasos, 100000);
    expect(segs[0].anchoPct).toBeGreaterThanOrEqual(1);
    expect(segs[1].anchoPct).toBeGreaterThanOrEqual(1);
  });
});

describe("computeChapterSegments — fallback por duracionMs", () => {
  it("usa duracionMs cuando faltan timestamps", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, duracionMs: 1000 }),
      paso({ id: "b", numero: 2, duracionMs: 3000 }),
    ];
    const segs = computeChapterSegments(pasos, 8000);
    expect(segs).toHaveLength(2);
    expect(segs[0].anchoPct).toBe(25); // 1000/4000 = 25%
    expect(segs[1].anchoPct).toBe(75); // 3000/4000 = 75%
    // Suman 100% del video (8s) repartidos proporcionalmente
    expect(segs[0].finMs - segs[0].inicioMs).toBeCloseTo(2000, 0);
    expect(segs[1].finMs - segs[1].inicioMs).toBeCloseTo(6000, 0);
  });

  it("reparte equitativamente si todos los pasos tienen duracionMs=0", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, duracionMs: 0 }),
      paso({ id: "b", numero: 2, duracionMs: 0 }),
      paso({ id: "c", numero: 3, duracionMs: 0 }),
    ];
    const segs = computeChapterSegments(pasos, 9000);
    expect(segs[0].anchoPct).toBe(33); // 100/3 ≈ 33
    expect(segs[1].anchoPct).toBe(33);
    expect(segs[2].anchoPct).toBe(33);
  });
});

describe("computeChapterSegments — edge cases", () => {
  it("devuelve [] si no hay pasos", () => {
    expect(computeChapterSegments([], 5000)).toEqual([]);
  });

  it("devuelve [] si videoDurationMs es 0", () => {
    const pasos: PasoConCapitulo[] = [paso({ id: "a", numero: 1, duracionMs: 1000 })];
    expect(computeChapterSegments(pasos, 0)).toEqual([]);
  });

  it("devuelve [] si videoDurationMs es negativo", () => {
    const pasos: PasoConCapitulo[] = [paso({ id: "a", numero: 1, duracionMs: 1000 })];
    expect(computeChapterSegments(pasos, -10)).toEqual([]);
  });

  it("mezcla: si un paso tiene timestamps y otro no, cae al fallback por duración", () => {
    const pasos: PasoConCapitulo[] = [
      paso({ id: "a", numero: 1, videoInicioMs: 0, videoFinMs: 1000, duracionMs: 1000 }),
      paso({ id: "b", numero: 2, videoInicioMs: null, videoFinMs: null, duracionMs: 3000 }),
    ];
    const segs = computeChapterSegments(pasos, 4000);
    // Como pasosTienenCapitulosValidos devuelve false (uno no tiene),
    // se usa el fallback por duración.
    expect(segs[0].anchoPct).toBe(25);
    expect(segs[1].anchoPct).toBe(75);
  });
});

describe("findChapterAtTime", () => {
  const segs = [
    { pasoId: "a", numero: 1, descripcion: "A", estado: "paso", inicioMs: 0, finMs: 1000, anchoPct: 25 },
    { pasoId: "b", numero: 2, descripcion: "B", estado: "paso", inicioMs: 1000, finMs: 3000, anchoPct: 50 },
    { pasoId: "c", numero: 3, descripcion: "C", estado: "fallo", inicioMs: 3000, finMs: 4000, anchoPct: 25 },
  ];

  it("devuelve el segmento activo", () => {
    expect(findChapterAtTime(segs as any, 500)?.pasoId).toBe("a");
    expect(findChapterAtTime(segs as any, 1500)?.pasoId).toBe("b");
    expect(findChapterAtTime(segs as any, 3500)?.pasoId).toBe("c");
  });

  it("devuelve el segmento al inicio exacto (inicioMs inclusive)", () => {
    expect(findChapterAtTime(segs as any, 0)?.pasoId).toBe("a");
    expect(findChapterAtTime(segs as any, 1000)?.pasoId).toBe("b");
  });

  it("devuelve null en un gap entre segmentos (finMs exclusive)", () => {
    // No hay gap en estos datos (contiguous), pero en el límite superior
    // de c devuelve null (4s no pertenece a c, fin es exclusivo).
    expect(findChapterAtTime(segs as any, 4000)).toBeNull();
  });

  it("devuelve null si el tiempo es anterior al primer segmento", () => {
    expect(findChapterAtTime(segs as any, -10)).toBeNull();
  });

  it("devuelve null si la lista está vacía", () => {
    expect(findChapterAtTime([], 500)).toBeNull();
  });
});