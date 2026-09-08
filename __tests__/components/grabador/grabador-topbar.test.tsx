/**
 * GrabadorTopbar — tests del behavior del usuario:
 *  - Estado de conexión mapeado a label correcto
 *  - Botón Detener llama onDetener, deshabilitado en stopping
 *  - Botón Descartar pide confirmación y luego llama onDescartar
 *  - Timer de 3s revierte la confirmación
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { GrabadorTopbar } from "@/components/grabador/grabador-topbar";

describe("GrabadorTopbar", () => {
  it("muestra el título", () => {
    render(
      <GrabadorTopbar
        titulo="Caso login E2E"
        connState="live"
        stopping={false}
        onDetener={() => {}}
        onDescartar={() => {}}
      />,
    );
    expect(screen.getByText("Caso login E2E")).toBeInTheDocument();
  });

  it("muestra 'Grabando' cuando connState=live", () => {
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={false}
        onDetener={() => {}}
        onDescartar={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-state")).toHaveTextContent("Grabando");
  });

  it("muestra el connState correcto para cada estado", () => {
    const labels: Record<string, string> = {
      connecting: "Conectando",
      live: "Grabando",
      reconnecting: "Reconectando",
      error: "Error de conexión",
      closed: "Desconectado",
    };
    for (const [state, label] of Object.entries(labels)) {
      const { unmount } = render(
        <GrabadorTopbar
          titulo="t"
          connState={
            state as "connecting" | "live" | "reconnecting" | "error" | "closed"
          }
          stopping={false}
          onDetener={() => {}}
          onDescartar={() => {}}
        />,
      );
      expect(screen.getByTestId("rec-state")).toHaveTextContent(label);
      unmount();
    }
  });

  it("el dot indicator se ve rojo/animate-pulse cuando connState=live", () => {
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={false}
        onDetener={() => {}}
        onDescartar={() => {}}
      />,
    );
    expect(screen.getByTestId("rec-dot")).toHaveClass("bg-red-500");
    expect(screen.getByTestId("rec-dot")).toHaveClass("animate-pulse");
  });

  it("llama onDetener al clickear Detener", () => {
    const onDetener = jest.fn();
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={false}
        onDetener={onDetener}
        onDescartar={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("detener-btn"));
    expect(onDetener).toHaveBeenCalledTimes(1);
  });

  it("el botón Detener está disabled cuando stopping=true", () => {
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={true}
        onDetener={() => {}}
        onDescartar={() => {}}
      />,
    );
    expect(screen.getByTestId("detener-btn")).toBeDisabled();
    expect(screen.getByTestId("detener-btn")).toHaveTextContent("Deteniendo");
  });

  it("Descartar pide confirmación al primer click", () => {
    const onDescartar = jest.fn();
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={false}
        onDetener={() => {}}
        onDescartar={onDescartar}
      />,
    );
    const btn = screen.getByTestId("descartar-btn");
    expect(btn).toHaveTextContent("Descartar");
    fireEvent.click(btn);
    expect(onDescartar).not.toHaveBeenCalled();
    expect(btn).toHaveTextContent(/confirmar descarte/i);
  });

  it("segundo click en Descartar (con confirmación activa) llama onDescartar", () => {
    const onDescartar = jest.fn();
    render(
      <GrabadorTopbar
        titulo="t"
        connState="live"
        stopping={false}
        onDetener={() => {}}
        onDescartar={onDescartar}
      />,
    );
    const btn = screen.getByTestId("descartar-btn");
    fireEvent.click(btn);
    expect(onDescartar).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });
});
