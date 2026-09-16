import { cn } from "@/lib/utils";

describe("cn", () => {
  it("concatena clases simples", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filtra valores falsy", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("soporta arrays de clases (clsx)", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("deduplica clases en conflicto con tailwind-merge", () => {
    // dos clases de padding para el mismo eje — twMerge deja la última.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("deduplica conflictos entre utilities y variantes", () => {
    expect(cn("text-red-500", "text-blue-700")).toBe("text-blue-700");
  });

  it("retorna string vacío sin inputs", () => {
    expect(cn()).toBe("");
  });
});
