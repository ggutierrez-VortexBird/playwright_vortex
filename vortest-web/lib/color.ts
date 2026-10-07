function canales(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrasteConBlanco(hex: string): number {
  const c = canales(hex);
  return c ? 1.05 / (luminancia(c) + 0.05) : 1;
}

/** Cuánto oscurecer (0–1) el color elegido por el usuario para que el texto blanco encima cumpla WCAG AA (4.5:1). */
export function oscurecimientoParaBlanco(hex: string, minimo = 4.5): number {
  const c = canales(hex);
  if (!c) return 0;
  for (let f = 1; f >= 0.3; f -= 0.02) {
    const oscuro = c.map((v) => v * f) as [number, number, number];
    if (1.05 / (luminancia(oscuro) + 0.05) >= minimo) return Math.round((1 - f) * 100) / 100;
  }
  return 0.7;
}

/** Capa negra translúcida que, puesta sobre el color del usuario, deja el texto blanco en AA. */
export function capaParaBlanco(hex: string): { backgroundColor: string } | null {
  const a = oscurecimientoParaBlanco(hex);
  return a > 0 ? { backgroundColor: `rgb(0 0 0 / ${a})` } : null;
}

/** El color del usuario oscurecido lo justo para que el texto blanco encima cumpla AA. */
export function colorLegibleConBlanco(hex: string): string {
  const c = canales(hex);
  if (!c) return hex;
  const f = 1 - oscurecimientoParaBlanco(hex);
  return `#${c.map((v) => Math.round(v * f).toString(16).padStart(2, "0")).join("")}`;
}
