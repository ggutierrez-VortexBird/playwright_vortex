"use client";

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
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">Color</label>
      <div className="flex flex-wrap gap-2">
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
      </div>
      {value && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
