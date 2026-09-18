import { forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Común a todas las variantes, incluida `ghost`.
const BASE = "disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

// Radio + tipografía del plan aprobado aplican solo a las variantes
// "sólidas" (primary/secondary/danger); `ghost` es un caso aparte (acciones
// de fila tipo icono, sin texto ni radio de 12px) y no lleva este bloque.
const SOLID_BASE = "rounded-md font-label text-label-md font-semibold";

const VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  // Filled, sin sombra — decisión deliberada del plan aprobado, no un olvido.
  primary: "bg-m3-primary text-m3-on-primary hover:opacity-90",
  secondary:
    "border border-m3-outline-variant bg-transparent text-m3-on-surface hover:bg-m3-surface-container-high",
  danger: "bg-m3-error text-m3-on-error hover:opacity-90",
  // Acciones de fila tipo icono — el llamador tiñe el hover por acción
  // (editar=primary, eliminar=error, etc.) vía className passthrough.
  ghost: "text-m3-on-surface-variant hover:bg-m3-surface-container-high",
};

const SIZE_CLASSNAMES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: "px-3 py-1.5 text-label-sm", md: "px-4 py-2.5" },
  secondary: { sm: "px-3 py-1.5 text-label-sm", md: "px-4 py-2.5" },
  danger: { sm: "px-3 py-1.5 text-label-sm", md: "px-4 py-2.5" },
  ghost: { sm: "p-1.5", md: "p-2" },
};

/**
 * Botón compartido para toda la app: cubre acciones primarias, secundarias,
 * destructivas y de fila (ghost/icono). Un solo lugar para el tratamiento
 * visual — variantes y tamaños, nunca clases repetidas por pantalla.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => {
    const isGhost = variant === "ghost";
    return (
      <button
        ref={ref}
        className={cn(
          BASE,
          !isGhost && SOLID_BASE,
          VARIANT_CLASSNAMES[variant],
          SIZE_CLASSNAMES[variant][size],
          isGhost && "rounded-lg",
          className
        )}
        {...rest}
      />
    );
  }
);

Button.displayName = "Button";

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    Pick<LinkProps, "href" | "prefetch" | "replace" | "scroll"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Variante navegable del botón: mismo tratamiento visual que <Button>, pero
 * renderiza un <Link> de Next.js en vez de un <button>. Existe porque
 * <Button onClick={...}> no puede usarse dentro de un Server Component
 * (React lanza "Event handlers cannot be passed to Client Component props")
 * — para acciones que solo navegan (p. ej. "Ir a casos"), usar <ButtonLink
 * href="..."> evita tener que convertir la página entera a Client Component.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = "primary", size = "md", className, href, prefetch, replace, scroll, ...rest }, ref) => {
    const isGhost = variant === "ghost";
    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        className={cn(
          BASE,
          !isGhost && SOLID_BASE,
          VARIANT_CLASSNAMES[variant],
          SIZE_CLASSNAMES[variant][size],
          isGhost && "rounded-lg",
          "inline-flex items-center justify-center",
          className
        )}
        {...rest}
      />
    );
  }
);

ButtonLink.displayName = "ButtonLink";
