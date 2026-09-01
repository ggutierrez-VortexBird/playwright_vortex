import { render, screen, act } from "@testing-library/react";
import { PasoPanel } from "@/components/grabador/paso-panel";
import {
  PASO_AGREGADO_EVENT,
  type PasoEnVivo,
} from "@/components/grabador/use-pasos-en-vivo";

// Mock scrollIntoView so jsdom doesn't choke.
Element.prototype.scrollIntoView = jest.fn();

function makePaso(overrides: Partial<PasoEnVivo> = {}): PasoEnVivo {
  return {
    id: "paso-1",
    numero: 1,
    tipo: "clic",
    descripcion: "Clic en «Ingresar»",
    valor: null,
    esValorSensible: false,
    parametroNombre: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

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

  it("accepts startedAt as an ISO string (server-rendered pages)", () => {
    const isoString = new Date(Date.now() - 30_000).toISOString();
    render(<PasoPanel startedAt={isoString} />);
    // 30 seconds = 00:30
    expect(screen.getByText(/00:30/)).toBeInTheDocument();
  });

  it("falls back to 'now' when startedAt is missing or invalid", () => {
    const { rerender } = render(<PasoPanel />);
    expect(screen.getByText(/00:00/)).toBeInTheDocument();

    rerender(<PasoPanel startedAt="not-a-date" />);
    // Invalid string → fall back to "now" → 00:00
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });
});

describe("PasoPanel — live mode (HU-G3)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders initialPasos when provided with sesionId (live mode)", () => {
    const initial = [
      makePaso({ id: "p-1", numero: 1, descripcion: "Clic en «A»" }),
      makePaso({ id: "p-2", numero: 2, descripcion: "Clic en «B»" }),
    ];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    expect(screen.getByText("Clic en «A»")).toBeInTheDocument();
    expect(screen.getByText("Clic en «B»")).toBeInTheDocument();
    expect(screen.getByText(/2 pasos/)).toBeInTheDocument();
  });

  it("appends pasos received via 'grabador-paso' window events", () => {
    const initial = [makePaso({ id: "p-1", numero: 1 })];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-2", numero: 2, descripcion: "Clic en «B»" }),
        }),
      );
    });

    expect(screen.getByText("Clic en «B»")).toBeInTheDocument();
    expect(screen.getByText(/2 pasos/)).toBeInTheDocument();
  });

  it("shows 'Recién agregado' badge on the latest paso (auto-clears after 3s)", () => {
    jest.useFakeTimers();
    render(<PasoPanel sesionId="ses-1" initialPasos={[]} />);

    // Fire the event.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1, descripcion: "Clic" }),
        }),
      );
    });

    // Badge appears.
    expect(screen.getByTestId("recien-agregado-p-1")).toBeInTheDocument();

    // Advance just past 3s.
    act(() => {
      jest.advanceTimersByTime(3001);
    });

    // Badge is gone.
    expect(
      screen.queryByTestId("recien-agregado-p-1"),
    ).not.toBeInTheDocument();
  });

  it("ignores events for a different sesionId", () => {
    const initial = [makePaso({ id: "p-1", numero: 1 })];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: {
            ...makePaso({ id: "p-x", numero: 99 }),
            sesionId: "ses-OTHER",
          },
        }),
      );
    });

    // Paso with id p-x should NOT appear.
    expect(screen.queryByText(/Clic en «Ingresar»/)).toBeInTheDocument();
    expect(screen.getByText(/1 paso/)).toBeInTheDocument();
  });

  it("dedupes events with the same paso id (defense against double-broadcast)", () => {
    const initial = [makePaso({ id: "p-1", numero: 1 })];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    act(() => {
      // Fire the same event twice.
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-2", numero: 2 }),
        }),
      );
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-2", numero: 2 }),
        }),
      );
    });

    expect(screen.getByText(/2 pasos/)).toBeInTheDocument();
  });

  it("auto-scrolls to bottom when new pasos arrive", () => {
    const scrollIntoView = jest.fn();
    const originalFn = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<PasoPanel sesionId="ses-1" initialPasos={[]} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
    });

    expect(scrollIntoView).toHaveBeenCalled();

    Element.prototype.scrollIntoView = originalFn;
  });

  it("renders verification pasos with the yellow accent border", () => {
    const initial = [
      makePaso({ id: "p-1", numero: 1, tipo: "verificar", descripcion: "Url es /dashboard" }),
    ];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    expect(screen.getByTestId("paso-verificacion-p-1")).toBeInTheDocument();
    expect(screen.getByText("Url es /dashboard")).toBeInTheDocument();
  });

  it("renders password pasos with a lock icon for esValorSensible=true", () => {
    const initial = [
      makePaso({
        id: "p-1",
        numero: 1,
        tipo: "escribir",
        descripcion: 'Escribir «••••••» (credencial) en «Contraseña»',
        esValorSensible: true,
      }),
    ];

    render(<PasoPanel sesionId="ses-1" initialPasos={initial} />);

    // Lock icon is rendered for esValorSensible pasos.
    expect(screen.getByLabelText("Valor sensible")).toBeInTheDocument();
    // The masked descripcion is rendered.
    expect(
      screen.getByText(/Escribir «••••••» \(credencial\) en «Contraseña»/),
    ).toBeInTheDocument();
  });
});
