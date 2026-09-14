"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SECTION_CONFIG: Record<string, { placeholder: string; ariaLabel: string }> = {
  casos: { placeholder: "Buscar caso…", ariaLabel: "Buscar caso" },
  espacios: { placeholder: "Buscar espacio…", ariaLabel: "Buscar espacio" },
  proyectos: { placeholder: "Buscar proyecto…", ariaLabel: "Buscar proyecto" },
  ejecuciones: { placeholder: "Buscar ejecución…", ariaLabel: "Buscar ejecución" },
};

const DEFAULT_SECTION = { placeholder: "Buscar caso, ejecución…", ariaLabel: "Buscar caso o ejecución" };

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  // Sección activa = primer segmento de la ruta (casos/espacios/proyectos/ejecuciones).
  // Para el resto (Inicio, Credenciales, Usuarios) cae al buscador genérico de casos.
  const section = pathname.split("/")[1] ?? "";
  const target = SECTION_CONFIG[section]
    ? { ...SECTION_CONFIG[section], base: `/${section}` }
    : { ...DEFAULT_SECTION, base: "/casos" };

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [pathname, searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `${target.base}?q=${encodeURIComponent(q)}` : target.base);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-m3-outline-variant bg-m3-background px-3.5 py-2 text-m3-on-surface-variant transition-colors focus-within:border-m3-secondary sm:flex"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={target.placeholder}
        aria-label={target.ariaLabel}
        className="w-full bg-transparent font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none"
      />
    </form>
  );
}
