"use client";

import { useRef } from "react";

interface ColorPickerProps {
  name: string;
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#C9822F", // client/orange
  "#0E6B4F", // seal/green
  "#A8322A", // stamp/red
  "#A9741A", // amber/yellow
  "#3F3A7A", // param/purple
  "#2F6FA8", // blue
  "#5C8A3A", // green-alt
  "#6B7C8D", // neutral
];

export function ColorPicker({
  name,
  value,
  onChange,
  colors = DEFAULT_COLORS,
}: ColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isCustomColor = value && !colors.includes(value);

  function handleCustomColorClick() {
    colorInputRef.current?.click();
  }

  function handleCustomColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">Color</label>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => {
          const isSelected = value === color;
          return (
            <button
              key={color}
              type="button"
              name={name}
              value={color}
              onClick={() => onChange(color)}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                isSelected
                  ? "border-ink scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Seleccionar color ${color}`}
              aria-pressed={isSelected}
            />
          );
        })}

        {/* Custom color picker */}
        <div className="relative">
          <button
            type="button"
            onClick={handleCustomColorClick}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
              isCustomColor
                ? "border-ink scale-110"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: isCustomColor ? value : "#e5e7eb" }}
            aria-label="Seleccionar color personalizado"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill={isCustomColor ? "#fff" : "#6b7280"}
            >
              <path
                fillRule="evenodd"
                d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={isCustomColor ? value : "#000000"}
            onChange={handleCustomColorChange}
            className="absolute inset-0 h-0 w-0 opacity-0"
            aria-label="Elegir color personalizado"
          />
        </div>
      </div>

      {value && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
