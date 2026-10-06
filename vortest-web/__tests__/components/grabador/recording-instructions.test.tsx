/**
 * RecordingInstructions — tests de la tarjeta instructiva del slot
 * izquierdo del grabador. Cubre los stats visibles y el error display.
 */
import { render, screen } from "@testing-library/react";
import { RecordingInstructions } from "@/components/grabador/recording-instructions";

describe("RecordingInstructions", () => {
  it("muestra el heading principal", () => {
    render(
      <RecordingInstructions
        urlInicial="https://app.example.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="connecting"
      />,
    );
    expect(
      screen.getByText(/Grabando en una ventana separada/i),
    ).toBeInTheDocument();
  });

  it("usa urlInicial como fallback si no se pasa currentUrl", () => {
    render(
      <RecordingInstructions
        urlInicial="https://initial.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="live"
      />,
    );
    expect(screen.getByTestId("recording-current-url")).toHaveTextContent(
      "https://initial.com",
    );
  });

  it("usa currentUrl cuando está presente (override)", () => {
    render(
      <RecordingInstructions
        urlInicial="https://initial.com"
        currentUrl="https://after-nav.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="live"
      />,
    );
    expect(screen.getByTestId("recording-current-url")).toHaveTextContent(
      "https://after-nav.com",
    );
  });

  it("muestra los stats pasados como props", () => {
    render(
      <RecordingInstructions
        urlInicial="https://x.com"
        pasosCount={7}
        assertionCount={3}
        bytes={2048}
        connState="live"
      />,
    );
    expect(screen.getByTestId("recording-pasos-count")).toHaveTextContent("7");
    expect(screen.getByTestId("recording-assertions-count")).toHaveTextContent("3");
    expect(screen.getByTestId("recording-bytes")).toHaveTextContent("2.0 KB");
    expect(screen.getByTestId("recording-conn-state")).toHaveTextContent("Live");
  });

  it("no muestra error si errorMsg es null/undefined", () => {
    render(
      <RecordingInstructions
        urlInicial="https://x.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="live"
        errorMsg={null}
      />,
    );
    expect(screen.queryByTestId("recording-error")).not.toBeInTheDocument();
  });

  it("muestra el mensaje de error cuando errorMsg es string", () => {
    render(
      <RecordingInstructions
        urlInicial="https://x.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="error"
        errorMsg="El worker cayó"
      />,
    );
    const err = screen.getByTestId("recording-error");
    expect(err).toHaveTextContent("El worker cayó");
  });

  it("connState=error muestra estado 'Error'", () => {
    render(
      <RecordingInstructions
        urlInicial="https://x.com"
        pasosCount={0}
        assertionCount={0}
        bytes={0}
        connState="error"
      />,
    );
    expect(screen.getByTestId("recording-conn-state")).toHaveTextContent("Error");
  });
});
