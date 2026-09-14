"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  "aria-label"?: string;
}

/**
 * Switch on/off basado en Radix (primitivo accesible y probado), en vez de
 * un botón hand-rolled — usar este para cualquier toggle nuevo.
 */
export function Switch({ checked, onCheckedChange, id, "aria-label": ariaLabel }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={`relative h-6 w-11 flex-none cursor-pointer rounded-full transition-colors data-[state=checked]:bg-m3-success data-[state=unchecked]:bg-m3-surface-container-high`}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
