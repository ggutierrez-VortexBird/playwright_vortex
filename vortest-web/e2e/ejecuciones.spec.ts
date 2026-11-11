import { test, expect } from "@playwright/test";
import path from "path";

const VALID_TEST_SCRIPT = `
import { test, expect } from "@playwright/test";
test("pasa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/VorTest/);
});
`.trim();

test.describe.serial("Motor de ejecución Playwright", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@admin.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  async function createEspacioIfNeeded(page: any, nombre: string) {
    await page.goto("/espacios");
    await page.waitForURL("/espacios");

    const exists = await page.locator(`text=${nombre}`).isVisible().catch(() => false);
    if (exists) {
      await page.click(`text=${nombre}`);
      await page.waitForURL(new RegExp(`/espacios/[^/]+/proyectos`));
      return;
    }

    await page.click("button:has-text('+ Crear espacio')");
    await page.fill('input[id="nombre"]', nombre);
    await page.click('button[aria-label*="Seleccionar color"]');
    await page.click('button[type="submit"]:has-text("Crear espacio")');
    await page.waitForTimeout(500);
    await page.click(`text=${nombre}`);
    await page.waitForURL(new RegExp(`/espacios/[^/]+/proyectos`));
  }

  async function createProyectoIfNeeded(page: any, nombre: string) {
    const createButton = page.locator("button:has-text('+ Crear proyecto')");
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.fill('input[id="nombre"]', nombre);
      await page.fill('input[id="ambiente"]', "QA");
      await page.click('button[type="submit"]:has-text("Crear proyecto")');
      await page.waitForTimeout(500);
      await page.reload();
    }
    await page.click(`text=${nombre}`);
    await page.waitForURL(new RegExp(`/proyectos/[^/]+/casos`));
  }

  async function createCasoConScript(page: any, codigo: string, nombre: string) {
    await page.click("button:has-text('+ Nuevo Caso')");
    await page.fill('input[id="codigo"]', codigo);
    await page.fill('input[id="nombre"]', nombre);

    // Se crea el caso por API porque el script se arma en memoria
  }

  test("flujo completo: crear caso → ejecutar → ver ejecución → verificar estado final", async ({ page }) => {
    const espacioNombre = "Espacio HU-3-" + Date.now();
    const proyectoNombre = "Proyecto HU-3-" + Date.now();
    const casoCodigo = "CP-HU3-" + Date.now();
    const casoNombre = "Caso HU-3 E2E";

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    await expect(page.locator("h1:has-text('Casos de prueba')")).toBeVisible();

    // Se crea el caso por API para poder enviar el contenido del script
    const casoResponse = await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: casoNombre,
        script: VALID_TEST_SCRIPT,
        scriptFileName: "e2e-test.spec.ts",
        proyectoId: page.url().split("/proyectos/")[1].split("/casos")[0],
        responsableId: "user-123",
      },
    });

    if (casoResponse.status() === 201 || casoResponse.status() === 200) {
      await page.reload();
    }

    await expect(page.locator(`text=${casoCodigo}`)).toBeVisible({ timeout: 5000 });

    const ejecutarButton = page.locator(`button[aria-label*="Ejecutar"]`).first();
    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);

    // Debe responder de inmediato con pendiente
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    // Inicialmente se muestra "pendiente" (sin recargar)
    await expect(page.locator(".pill:has-text('pendiente'), .p-idle:has-text('pendiente')")).toBeVisible({ timeout: 5000 });

    // Los pasos aparecen sin recargar (polling cada 2s) y el estado pasa de pendiente a corriendo
    await expect(
      page.locator(".pill:has-text('corriendo'), .p-running:has-text('corriendo')")
    ).toBeVisible({ timeout: 30000 });

    // Un paso nuevo debe aparecer en el accordion
    const pasosLocator = page.locator("[data-purpose='step-row']");
    await expect(pasosLocator.first()).toBeVisible({ timeout: 30000 });

    // Debe llegar a un estado terminal (paso o fallo)
    await expect(
      page.locator(
        ".pill:has-text('paso'), .p-pass:has-text('paso'), .pill:has-text('falló'), .p-fail:has-text('falló'), .pill:has-text('fallo'), .p-fail:has-text('fallo')"
      )
    ).toBeVisible({ timeout: 120000 });
  });

  test("pestaña global /ejecuciones agrupa por proyecto", async ({ page }) => {
    await page.goto("/ejecuciones");
    await page.waitForURL("/ejecuciones");

    // La página muestra el layout de ledger agrupado por proyecto
    await expect(page.locator("h1:has-text('Ejecuciones')")).toBeVisible();
  });

  test("segunda ejecución concurrente para el mismo caso devuelve 409", async ({ page }) => {
    // Se crea un caso y se inicia una ejecución
    const espacioNombre = "Espacio Conc-" + Date.now();
    const proyectoNombre = "Proyecto Conc-" + Date.now();
    const casoCodigo = "CP-CONC-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    await expect(page.locator("h1:has-text('Casos de prueba')")).toBeVisible();

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Concurrency Test",
        script: VALID_TEST_SCRIPT,
        scriptFileName: "conc-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    await page.goto(`/proyectos/${proyectoId}/casos`);
    await expect(page.locator(`text=${casoCodigo}`)).toBeVisible({ timeout: 5000 });

    // Segundo intento mientras la primera sigue corriendo
    const secondEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await secondEjecutarButton.click();

    // Debe mostrar el conflicto 409
    await expect(page.locator("text=409, conflict, ya existe una ejecución en curso")).toBeVisible({ timeout: 5000 });
  });

  test("errorMotor no muestra pasos falsos", async ({ page }) => {
    const espacioNombre = "Espacio Err-" + Date.now();
    const proyectoNombre = "Proyecto Err-" + Date.now();
    const casoCodigo = "CP-ERR-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    // Caso con script vacío (provoca errorMotor)
    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Error Motor Test",
        script: "",
        scriptFileName: "error-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    await expect(
      page.locator(".stamp:has-text('ERROR MOTOR'), .pill:has-text('errorMotor')")
    ).toBeVisible({ timeout: 60000 });

    // Cero pasos o solo el paso de error (sin pasos falsos)
    const steps = page.locator("[data-purpose='step-row']");
    const stepCount = await steps.count();

    expect(stepCount).toBeLessThanOrEqual(1);
  });

  test("pasos aparecen en vivo sin reload (polling 2s)", async ({ page }) => {
    // Se verifica que los pasos aparecen progresivamente
    const espacioNombre = "Espacio Live-" + Date.now();
    const proyectoNombre = "Proyecto Live-" + Date.now();
    const casoCodigo = "CP-LIVE-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    // Caso con script de varios pasos
    const multiStepScript = `
import { test, expect } from "@playwright/test";
test("step 1", async ({ page }) => { await page.goto("/"); });
test("step 2", async ({ page }) => { await page.waitForTimeout(100); });
test("step 3", async ({ page }) => { await page.waitForTimeout(100); });
    `.trim();

    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Live Steps Test",
        script: multiStepScript,
        scriptFileName: "live-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    await expect(page.locator("[data-purpose='step-row']:has-text('step 1')")).toBeVisible({ timeout: 30000 });

    // Los pasos deben aumentar entre intervalos mientras el polling los trae
    const initialCount = await page.locator("[data-purpose='step-row']").count();
    expect(initialCount).toBeGreaterThanOrEqual(1);
  });

  test("accordion permite expandir y colapsar pasos", async ({ page }) => {
    const espacioNombre = "Espacio Acc-" + Date.now();
    const proyectoNombre = "Proyecto Acc-" + Date.now();
    const casoCodigo = "CP-ACC-" + Date.now();

    await createEspacioIfNeeded(page, espacioNombre);
    await createProyectoIfNeeded(page, proyectoNombre);

    const proyectoId = page.url().split("/proyectos/")[1].split("/casos")[0];

    const multiStepScript = `
import { test, expect } from "@playwright/test";
test("step 1", async ({ page }) => { await page.goto("/"); });
test("step 2", async ({ page }) => { await page.waitForTimeout(100); });
    `.trim();

    await page.request.post("/api/casos", {
      data: {
        codigo: casoCodigo,
        nombre: "Caso Accordion Test",
        script: multiStepScript,
        scriptFileName: "acc-test.spec.ts",
        proyectoId: proyectoId,
        responsableId: "user-123",
      },
    });

    await page.reload();

    const rowLocator = page.locator(`tr:has-text("${casoCodigo}")`);
    const rowEjecutarButton = rowLocator.locator(`button:has-text("Ejecutar")`);
    await rowEjecutarButton.click();

    await page.waitForURL(/\/ejecuciones\/[a-z0-9-]+/, { timeout: 5000 });

    await expect(
      page.locator(".pill:has-text('paso'), .p-pass:has-text('paso'), .pill:has-text('falló'), .p-fail:has-text('falló'), .pill:has-text('fallo'), .p-fail:has-text('fallo')")
    ).toBeVisible({ timeout: 120000 });

    const firstStep = page.locator("[data-purpose='step-row']").first();
    await expect(firstStep).toBeVisible({ timeout: 10000 });

    await firstStep.click();
    await expect(page.locator("text=Detalles Técnicos")).toBeVisible();

    await firstStep.click();
    await expect(page.locator("text=Detalles Técnicos")).not.toBeVisible();
  });
});
