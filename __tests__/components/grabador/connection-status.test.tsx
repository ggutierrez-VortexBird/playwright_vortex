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
  });
});
