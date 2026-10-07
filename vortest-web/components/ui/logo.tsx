import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** "light": login, sigue el tema. "dark": siempre sobre fondo oscuro (sidebar). */
  variant?: "light" | "dark";
  className?: string;
}

const SIZES: Record<"light" | "dark", { width: number; height: number }> = {
  light: { width: 176, height: 61 },
  dark: { width: 140, height: 49 },
};

export function Logo({ variant = "light", className }: LogoProps) {
  const { width, height } = SIZES[variant];
  if (variant === "dark") {
    return <Image src="/logo-oscuro.png" alt="vorTest" width={width} height={height} priority className={className} />;
  }
  return (
    <>
      <Image src="/logo.png" alt="vorTest" width={width} height={height} priority className={cn("solo-tema-claro", className)} />
      <Image src="/logo-oscuro.png" alt="vorTest" width={width} height={height} priority className={cn("solo-tema-oscuro", className)} />
    </>
  );
}
