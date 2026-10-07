// __tests__/components/ejecuciones/detener-button.test.tsx
// Tests for HU-3 Botón Detener — DetenerButton client component
//
// Contrato (components/ejecuciones/detener-button.tsx):
// - Props: { ejecucionId, visible, onDetenida? }
// - Si `visible === false`, no renderiza nada
// - Al hacer clic abre un ConfirmDialog ("¿Detener la ejecución?"); no hay fetch hasta confirmar
// - Confirmar → POST /api/ejecuciones/:id/detener
//   * 2xx → toast "Ejecución detenida" y llama onDetenida
//   * 409/403/404/otro → toast "No se pudo detener" con el motivo en español
//   * excepción → toast "Sin conexión con el servidor"
// - Mientras envía, el botón de confirmar queda en "Deteniendo…" y deshabilitado

import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetenerButton } from "@/components/ejecuciones/detener-button";
import { ToastProvider } from "@/components/ui/toast";

function montar(props: Partial<React.ComponentProps<typeof DetenerButton>> = {}) {
  return render(
    <ToastProvider>
      <DetenerButton ejecucionId="ejec-1" visible {...props} />
    </ToastProvider>,
  );
}

async function abrirYConfirmar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /detener ejecución/i }));
  const dialogo = await screen.findByRole("dialog");
  await user.click(within(dialogo).getByRole("button", { name: /^detener$/i }));
}

describe("DetenerButton (HU-3 Botón Detener)", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("no renderiza nada cuando visible=false", () => {
    const { container } = montar({ visible: false });
    expect(container.querySelector("button")).toBeNull();
  });

  it("renderiza el botón con texto 'Detener' cuando visible=true", () => {
    montar();
    const btn = screen.getByRole("button", { name: /detener ejecución/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/detener/i);
  });

  it("pide confirmación con el diálogo de la app antes de hacer fetch", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/¿detener la ejecución\?/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("NO llama a fetch si el usuario elige 'Seguir ejecutando'", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));
    await user.click(await screen.findByRole("button", { name: /seguir ejecutando/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hace POST al endpoint correcto cuando el usuario confirma", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const user = userEvent.setup();
    montar({ ejecucionId: "ejec-abc" });

    await abrirYConfirmar(user);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/ejecuciones/ejec-abc/detener", expect.objectContaining({ method: "POST" }));
    });
  });

  it("avisa y llama onDetenida después de éxito (200)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const onDetenida = jest.fn();
    const user = userEvent.setup();
    montar({ onDetenida });

    await abrirYConfirmar(user);

    expect(await screen.findByText("Ejecución detenida")).toBeInTheDocument();
    expect(onDetenida).toHaveBeenCalled();
  });

  it.each([
    [409, /la ejecución ya había terminado/i],
    [403, /no tienes permiso para detener/i],
    [404, /la ejecución ya no existe/i],
    [500, /el servidor respondió 500/i],
  ])("muestra el motivo en español cuando el estado es %s", async (status, motivo) => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status, json: async () => ({}) });
    const user = userEvent.setup();
    montar();

    await abrirYConfirmar(user);

    expect(await screen.findByText("No se pudo detener")).toBeInTheDocument();
    expect(screen.getByText(motivo)).toBeInTheDocument();
  });

  it("muestra 'Sin conexión con el servidor' cuando fetch lanza", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    montar();

    await abrirYConfirmar(user);

    expect(await screen.findByText(/sin conexión con el servidor/i)).toBeInTheDocument();
  });
});
