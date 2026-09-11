"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/casos?q=${encodeURIComponent(q)}` : "/casos");
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
        placeholder="Buscar caso, ejecución…"
        aria-label="Buscar caso o ejecución"
        className="w-full bg-transparent font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none"
      />
    </form>
  );
}
