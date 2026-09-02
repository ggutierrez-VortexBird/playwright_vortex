import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "@/components/grabador/connection-status";

describe("ConnectionStatus", () => {
  describe("compact REC badge (browser chrome mode)", () => {
    it("shows the REC label", () => {
      render(<ConnectionStatus state="live" />);
      expect(screen.getByText("REC")).toBeInTheDocument();
    });

    it("renders the pulse-red indicator dot", () => {
      const { container } = render(<ConnectionStatus state="live" />);
      expect(container.querySelector(".pulse-red")).toBeInTheDocument();
    });
  });

  describe("inline mode (canvas overlay)", () => {
    it("renders the EN VIVO label when state is live", () => {
      render(<ConnectionStatus state="live" mode="inline" />);
      expect(screen.getByText("EN VIVO")).toBeInTheDocument();
    });

    it("renders the INICIANDO label when connecting", () => {
      render(<ConnectionStatus state="connecting" mode="inline" />);
      expect(screen.getByText("INICIANDO")).toBeInTheDocument();
    });

it("renders the RECONECTANDO label when reconnecting", () => {
    render(<ConnectionStatus state="reconnecting" mode="inline" />);
    expect(screen.getByText("RECONECTANDO")).toBeInTheDocument();
  });

  it("muestra 'Reintentando conexión…' como ayuda cuando reconnecting", () => {
    render(<ConnectionStatus state="reconnecting" mode="inline" />);
    expect(screen.getByText("Reintentando conexión…")).toBeInTheDocument();
  });

  it("el dot pulsa cuando está en modo inline y reconnecting (visualmente diferenciado)", () => {
    const { container } = render(<ConnectionStatus state="reconnecting" mode="inline" />);
    const dot = container.querySelector(".pulse-red");
    expect(dot).toBeInTheDocument();
    // En reconnecting el dot tiene opacity-60 (no es el pulso rojo brillante del live)
    expect(dot).toHaveClass("opacity-60");
  });

  it("renderiza REC badge compacto (browser chrome) también en reconnecting", () => {
    // HU-GR-1 — el badge del browser chrome debe seguir visible aunque
    // el WS esté reconectando; el usuario sabe que la sesión está ahí.
    const { container } = render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("REC")).toBeInTheDocument();
    expect(container.querySelector(".pulse-red")).toBeInTheDocument();
  });
});
});
