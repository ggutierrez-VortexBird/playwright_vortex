"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ROL_LABEL, type RolUsuario } from "@/lib/roles";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface UserMenuProps {
  email: string;
  rol: RolUsuario;
}

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
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-m3-primary font-label text-label-sm font-bold text-m3-on-primary transition-opacity duration-fast hover:opacity-90"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-dropdown w-64 animate-in fade-in-0 zoom-in-95 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-2 shadow-card">
          <div className="px-3 py-2">
            <div className="truncate font-body text-body-md font-medium text-m3-on-surface">
              {email}
            </div>
            <span className="mt-1 inline-flex items-center rounded-full bg-m3-surface-container-high px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
              {ROL_LABEL[rol] ?? rol}
            </span>
          </div>
          <div className="my-1 border-t border-m3-outline-variant" />
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-label text-label-md text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
          >
            <Icon name="person" size={18} />
            Mi perfil
          </Link>
          <div className="px-3 pb-1 pt-2">
            <p className="mb-1.5 font-label text-label-sm text-m3-on-surface-variant">Tema</p>
            <ThemeToggle />
          </div>
          <div className="my-1 border-t border-m3-outline-variant" />
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-label text-label-md text-m3-error transition-colors hover:bg-m3-error-container/40"
            >
              <Icon name="logout" size={18} />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
