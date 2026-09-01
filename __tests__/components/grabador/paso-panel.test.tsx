import { render, screen } from "@testing-library/react";
import { PasoPanel } from "@/components/grabador/paso-panel";

describe("PasoPanel", () => {
  it("renders the PASOS REGISTRADOS header", () => {
    render(<PasoPanel />);
    expect(screen.getByText("PASOS REGISTRADOS")).toBeInTheDocument();
  });

  it("shows the empty state when there are no pasos", () => {
    render(<PasoPanel />);
    expect(
      screen.getByText("Esperando interacción en el navegador..."),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 pasos/)).toBeInTheDocument();
  });

  it("uses the singular form when there is exactly 1 paso", () => {
    render(
      <PasoPanel
        pasos={[
          { numero: 1, titulo: "Abrir portal bancario" },
        ]}
      />,
    );
    expect(screen.getByText(/1 paso/)).toBeInTheDocument();
    expect(
      screen.queryByText("Esperando interacción en el navegador..."),
    ).toBeInTheDocument();
  });

  it("uses the plural form when there are multiple pasos", () => {
    render(
      <PasoPanel
        pasos={[
          { numero: 1, titulo: "Abrir portal" },
          { numero: 2, titulo: "Escribir usuario" },
          { numero: 3, titulo: "Click en ingresar" },
        ]}
      />,
    );
    expect(screen.getByText(/3 pasos/)).toBeInTheDocument();
  });

  it("renders the elapsed timer in MM:SS format", () => {
    render(
      <PasoPanel startedAt={new Date(Date.now() - 75_000)} />,
    );
    // 75 seconds = 01:15
    expect(screen.getByText(/01:15/)).toBeInTheDocument();
  });
});
