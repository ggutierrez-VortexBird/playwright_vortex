/**
 * PasoPanel — tests sobre cómo se renderiza el panel derecho del grabador
 * (parseo del spec en vivo). Cubre cada tipo de paso emitido por
 * Playwright codegen y los estados vacíos.
 */
import { render, screen } from "@testing-library/react";
import { PasoPanel } from "@/components/grabador/paso-panel";

const SAMPLE_SPEC = `import { test, expect } from '@playwright/test';

test('login', async ({ page }) => {
  await page.goto('https://app.example.com/login');
  await page.getByLabel('Email').fill('foo@example.com');
  await page.getByLabel('Password').fill('super-secret-123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
});
`;

describe("PasoPanel", () => {
  it("muestra estado vacío cuando specContent es vacío y isLive=false", () => {
    render(<PasoPanel specContent="" bytes={0} isLive={false} />);
    expect(screen.getByTestId("paso-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/Iniciá la grabación para ver los pasos acá/i),
    ).toBeInTheDocument();
  });

  it("muestra copy distinto cuando isLive=true pero todavía no hay pasos", () => {
    render(<PasoPanel specContent="" bytes={0} isLive={true} />);
    expect(screen.getByTestId("paso-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/Esperando el primer paso/i),
    ).toBeInTheDocument();
  });

  it("renderiza un item por cada paso parseado", () => {
    render(
      <PasoPanel specContent={SAMPLE_SPEC} bytes={SAMPLE_SPEC.length} isLive />,
    );
    const items = screen.getAllByTestId("paso-item");
    expect(items).toHaveLength(5); // goto + fill + fill + click + assertion
    // Vamos a verificar los kinds en orden
    expect(items[0]!.dataset["pasoKind"]).toBe("goto");
    expect(items[1]!.dataset["pasoKind"]).toBe("fill");
    expect(items[2]!.dataset["pasoKind"]).toBe("fill");
    expect(items[3]!.dataset["pasoKind"]).toBe("click");
    expect(items[4]!.dataset["pasoKind"]).toBe("assertion");
  });

  it("muestra el contador correcto de pasos en el header", () => {
    render(<PasoPanel specContent={SAMPLE_SPEC} bytes={512} isLive />);
    expect(screen.getByTestId("paso-count")).toHaveTextContent("5");
  });

  it("el footer muestra KB formateado", () => {
    render(<PasoPanel specContent={SAMPLE_SPEC} bytes={2048} isLive />);
    // 2048 / 1024 = 2.0 KB
    expect(screen.getByTestId("paso-panel-footer")).toHaveTextContent(
      "5 pasos · 2.0 KB de spec.ts",
    );
  });

  it("el footer muestra bytes cuando < 1KB", () => {
    render(<PasoPanel specContent="x" bytes={512} isLive />);
    expect(screen.getByTestId("paso-panel-footer")).toHaveTextContent(
      /512 B/,
    );
  });

  it("el contador muestra singular si hay 1 solo paso", () => {
    const oneStep = `await page.goto('https://x.com');`;
    render(<PasoPanel specContent={oneStep} bytes={50} isLive />);
    expect(screen.getByTestId("paso-count")).toHaveTextContent("1");
    expect(screen.getByTestId("paso-panel-footer")).toHaveTextContent(/1 paso/);
  });
});
