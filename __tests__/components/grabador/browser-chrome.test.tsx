/**
 * BrowserChrome — tests sobre el input URL y el submit:
 *  - Render del draft inicial con pageUrl
 *  - Sincronización del draft cuando pageUrl cambia
 *  - Submit del form llama onNavigate con la URL trimmed
 *  - Botón Ir deshabilitado cuando el input está vacío
 *  - Disabled cuando disabled=true (sesión no live)
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BrowserChrome } from "@/components/grabador/browser-chrome";

describe("BrowserChrome", () => {
  it("renderiza el input con pageUrl como valor inicial", () => {
    render(
      <BrowserChrome
        pageUrl="https://app.example.com"
        onNavigate={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("bc-url")).toHaveValue("https://app.example.com");
  });

  it("sincroniza el draft cuando pageUrl cambia desde afuera", () => {
    const { rerender } = render(
      <BrowserChrome
        pageUrl="https://a.com"
        onNavigate={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("bc-url")).toHaveValue("https://a.com");
    rerender(
      <BrowserChrome
        pageUrl="https://b.com"
        onNavigate={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("bc-url")).toHaveValue("https://b.com");
  });

  it("submit del form llama onNavigate con URL trimmed", () => {
    const onNavigate = jest.fn();
    render(
      <BrowserChrome
        pageUrl="https://a.com"
        onNavigate={onNavigate}
        disabled={false}
      />,
    );
    const input = screen.getByTestId("bc-url");
    fireEvent.change(input, { target: { value: "  https://new.com/path  " } });
    fireEvent.submit(screen.getByTestId("bc-form"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("https://new.com/path");
  });

  it("Botón Ir deshabilitado cuando el input está vacío", () => {
    render(
      <BrowserChrome
        pageUrl=""
        onNavigate={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByTestId("bc-go")).toBeDisabled();
  });

  it("Botón Ir deshabilitado cuando disabled=true (sesión no live)", () => {
    render(
      <BrowserChrome
        pageUrl="https://a.com"
        onNavigate={() => {}}
        disabled={true}
      />,
    );
    expect(screen.getByTestId("bc-go")).toBeDisabled();
  });

  it("submit no llama onNavigate cuando disabled=true", () => {
    const onNavigate = jest.fn();
    render(
      <BrowserChrome
        pageUrl="https://a.com"
        onNavigate={onNavigate}
        disabled={true}
      />,
    );
    fireEvent.submit(screen.getByTestId("bc-form"));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
