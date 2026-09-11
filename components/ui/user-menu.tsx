"use client";

import { useEffect, useRef, useState } from "react";

interface UserMenuProps {
  email: string;
  rol: string;
}

const ROL_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tester: "Tester",
};

export function UserMenu({ email, rol }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = email.slice(0, 2).toUpperCase();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-m3-primary-container font-label text-label-sm font-bold text-m3-on-primary transition-opacity hover:opacity-90"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-64 rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-2 shadow-card">
          <div className="px-3 py-2">
            <div className="truncate font-body text-body-md font-medium text-m3-on-surface">
              {email}
            </div>
            <span className="mt-1 inline-flex items-center rounded-full bg-m3-surface-container-high px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
              {ROL_LABEL[rol] ?? rol}
            </span>
          </div>
          <div className="my-1 border-t border-m3-outline-variant" />
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-label text-label-md text-m3-error transition-colors hover:bg-m3-error-container/40"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
