/**
 * Tests for components/grabador/rec-toolbar.tsx — wired toolbar (HU-G5, HU-G7).
 *
 * Covers:
 *   - All 4 buttons render with their data-testid.
 *   - "Señalar elemento" toggles aria-pressed + visual state when clicked.
 *   - "Pausar" toggles paused state with play_arrow/pause icon swap.
 *   - "Verificar" / "Parámetro" shortcuts show a toast if signal mode is off.
 *   - When `disabled` is true, all buttons are non-interactive.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { RecToolbar } from "@/components/grabador/rec-toolbar";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function renderToolbar(overrides: Partial<React.ComponentProps<typeof RecToolbar>> = {}) {
  const onToggleSignal = jest.fn();
  const onActionVerificar = jest.fn();
  const onActionParametro = jest.fn();
  const onTogglePause = jest.fn();
  const utils = render(
    <RecToolbar
      signalActive={false}
      paused={false}
      onToggleSignal={onToggleSignal}
      onActionVerificar={onActionVerificar}
      onActionParametro={onActionParametro}
      onTogglePause={onTogglePause}
      {...overrides}
    />,
  );
  return {
    onToggleSignal,
    onActionVerificar,
    onActionParametro,
    onTogglePause,
    ...utils,
  };
}

describe("RecToolbar — wired (HU-G5, HU-G7)", () => {
  it("renders all 4 buttons", () => {
    renderToolbar();
    expect(screen.getByTestId("tool-senalar")).toBeInTheDocument();
    expect(screen.getByTestId("tool-verificar")).toBeInTheDocument();
    expect(screen.getByTestId("tool-parametro")).toBeInTheDocument();
    expect(screen.getByTestId("tool-pausar")).toBeInTheDocument();
  });

  it("shows the 'Señalar elemento' label", () => {
    renderToolbar();
    expect(screen.getByText("Señalar elemento")).toBeInTheDocument();
  });

  it("does NOT disable the buttons by default (HU-G5 wired)", () => {
    renderToolbar();
    expect(screen.getByTestId("tool-senalar")).not.toBeDisabled();
    expect(screen.getByTestId("tool-verificar")).not.toBeDisabled();
    expect(screen.getByTestId("tool-parametro")).not.toBeDisabled();
    expect(screen.getByTestId("tool-pausar")).not.toBeDisabled();
  });

  it("disables all buttons when `disabled` is true", () => {
    renderToolbar({ disabled: true });
    expect(screen.getByTestId("tool-senalar")).toBeDisabled();
    expect(screen.getByTestId("tool-verificar")).toBeDisabled();
    expect(screen.getByTestId("tool-parametro")).toBeDisabled();
    expect(screen.getByTestId("tool-pausar")).toBeDisabled();
  });

  it("Señalar elemento click invokes onToggleSignal", () => {
    const { onToggleSignal } = renderToolbar();
    fireEvent.click(screen.getByTestId("tool-senalar"));
    expect(onToggleSignal).toHaveBeenCalledTimes(1);
  });

  it("Señalar elemento shows pressed state when signalActive=true (aria-pressed=true)", () => {
    renderToolbar({ signalActive: true });
    expect(screen.getByTestId("tool-senalar")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("Señalar elemento shows unpressed state when signalActive=false (aria-pressed=false)", () => {
    renderToolbar({ signalActive: false });
    expect(screen.getByTestId("tool-senalar")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("Pausar click invokes onTogglePause", () => {
    const { onTogglePause } = renderToolbar();
    fireEvent.click(screen.getByTestId("tool-pausar"));
    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  it("Pausar icon shows pause by default", () => {
    renderToolbar({ paused: false });
    expect(screen.getByTestId("tool-pausar").textContent).toContain("pause");
  });

  it("Pausar icon swaps to play_arrow when paused", () => {
    renderToolbar({ paused: true });
    const btn = screen.getByTestId("tool-pausar");
    expect(btn.textContent).toContain("play_arrow");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("Verificar shortcut shows toast when signal mode is OFF and does NOT call action", () => {
    const { onActionVerificar } = renderToolbar({ signalActive: false });
    fireEvent.click(screen.getByTestId("tool-verificar"));
    expect(onActionVerificar).not.toHaveBeenCalled();
    expect(screen.getByTestId("rec-toolbar-toast")).toBeInTheDocument();
    expect(screen.getByTestId("rec-toolbar-toast").textContent).toContain(
      "Señalá un elemento primero",
    );
  });

  it("Parámetro shortcut shows toast when signal mode is OFF and does NOT call action", () => {
    const { onActionParametro } = renderToolbar({ signalActive: false });
    fireEvent.click(screen.getByTestId("tool-parametro"));
    expect(onActionParametro).not.toHaveBeenCalled();
    expect(screen.getByTestId("rec-toolbar-toast")).toBeInTheDocument();
  });

  it("Verificar invokes action when signal mode is ON", () => {
    const { onActionVerificar } = renderToolbar({ signalActive: true });
    fireEvent.click(screen.getByTestId("tool-verificar"));
    expect(onActionVerificar).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("rec-toolbar-toast")).not.toBeInTheDocument();
  });

  it("Parámetro invokes action when signal mode is ON", () => {
    const { onActionParametro } = renderToolbar({ signalActive: true });
    fireEvent.click(screen.getByTestId("tool-parametro"));
    expect(onActionParametro).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("rec-toolbar-toast")).not.toBeInTheDocument();
  });

  it("toast auto-hides after 2.5s", () => {
    renderToolbar({ signalActive: false });
    fireEvent.click(screen.getByTestId("tool-verificar"));
    expect(screen.getByTestId("rec-toolbar-toast")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(screen.queryByTestId("rec-toolbar-toast")).not.toBeInTheDocument();
  });
});
