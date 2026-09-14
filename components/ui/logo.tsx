interface LogoProps {
  /** "light" = fondo claro (texto "Athe" oscuro); "dark" = fondo navy (texto "Athe" blanco). */
  variant?: "light" | "dark";
  className?: string;
}

export function Logo({ variant = "light", className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-headline text-[22px] font-bold leading-none ${className ?? ""}`}>
      <span className="material-symbols-outlined text-[22px] text-[#2f8fe0]" aria-hidden="true">
        search
      </span>
      <span>
        <span className={variant === "dark" ? "text-white" : "text-m3-on-surface"}>Athe</span>
        <span className="text-m3-secondary-container">App</span>
      </span>
    </span>
  );
}
