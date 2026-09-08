/**
 * RecToolbar — tests sobre el toolbar inferior (URL actual + Copiar + Detener).
 *  - Renderiza la URL actual en mono
 *  - Botón Copiar deshabilitado cuando specContent está vacío
 *  - Botón Copiar deshabilitado cuando disabled=true
 *  - Botón Detener llama onDetener
 *  - Si no hay currentUrl → muestra "(sin URL)"
 */

// navigator.clipboard mock
const clipboardWrite = jest.fn(async () => undefined);
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: clipboardWrite },
  writable: true,
});

import { render, screen, fireEvent } from "@testing-library/react";
import { RecToolbar } from "@/components/grabador/rec-toolbar";

beforeEach(() => {
  clipboardWrite.mockClear();
});

describe("RecToolbar", () => {
  it("renderiza la URL actual", () => {
    render(
      <RecToolbar
        currentUrl="https://app.example.com"
        specContent="x"
        disabled={false}
        onDetener={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-toolbar-url")).toHaveTextContent(
      "https://app.example.com",
    );
  });

  it("muestra '(sin URL)' cuando no hay currentUrl", () => {
    render(
      <RecToolbar
        specContent="x"
        disabled={false}
        onDetener={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-toolbar-url")).toHaveTextContent(
      "(sin URL)",
    );
  });

  it("botón Copiar deshabilitado cuando specContent está vacío", () => {
    render(
      <RecToolbar
        currentUrl="https://x.com"
        specContent=""
        disabled={false}
        onDetener={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-toolbar-copy")).toBeDisabled();
  });

  it("botón Copiar deshabilitado cuando disabled=true", () => {
    render(
      <RecToolbar
        currentUrl="https://x.com"
        specContent="x"
        disabled={true}
        onDetener={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-toolbar-copy")).toBeDisabled();
  });

  it("click en Copiar llama a clipboard.writeText con el spec", async () => {
    render(
      <RecToolbar
        currentUrl="https://x.com"
        specContent={"line1\nline2\n"}
        disabled={false}
        onDetener={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("rec-toolbar-copy"));
    expect(clipboardWrite).toHaveBeenCalledWith("line1\nline2\n");
  });

  it("click en Detener llama onDetener", () => {
    const onDetener = jest.fn();
    render(
      <RecToolbar
        currentUrl="https://x.com"
        specContent="x"
        disabled={false}
        onDetener={onDetener}
      />,
    );
    fireEvent.click(screen.getByTestId("rec-toolbar-stop"));
    expect(onDetener).toHaveBeenCalledTimes(1);
  });
});
