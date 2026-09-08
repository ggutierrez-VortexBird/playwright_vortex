import { findFragileSelectors } from "@/lib/recorder/selector-lint";

describe("findFragileSelectors", () => {
  it("detecta page.locator('div').first()", () => {
    const spec = [
      "import { test, expect } from '@playwright/test';",
      "",
      "test('test', async ({ page }) => {",
      "  await page.goto('https://x');",
      "  await page.locator('div').first().click();",
      "});",
    ].join("\n");

    const warnings = findFragileSelectors(spec);
    expect(warnings).toEqual([
      { line: 5, text: "await page.locator('div').first().click();" },
    ]);
  });

  it("detecta .nth(N) además de .first()/.last()", () => {
    const spec = "await page.locator('span').nth(2).click();";
    expect(findFragileSelectors(spec)).toEqual([
      { line: 1, text: "await page.locator('span').nth(2).click();" },
    ]);
  });

  it("no marca selectores robustos por rol, texto o testid", () => {
    const spec = [
      "await page.getByRole('option', { name: 'Balon futbol' }).click();",
      "await page.getByText('Balon futbol').click();",
      "await page.getByTestId('opt-1').click();",
      "await page.locator('li.sb-suggestions__item').first().click();",
      "await page.locator('[data-value=\"Balon futbol\"]').click();",
    ].join("\n");

    expect(findFragileSelectors(spec)).toEqual([]);
  });

  it("devuelve [] para specCode vacío o null-ish", () => {
    expect(findFragileSelectors("")).toEqual([]);
  });

  it("reporta varias líneas frágiles, con su número correcto", () => {
    const spec = [
      "line 1",
      "await page.locator('div').first().click();",
      "line 3",
      "await page.locator('a').last().click();",
    ].join("\n");

    expect(findFragileSelectors(spec)).toEqual([
      { line: 2, text: "await page.locator('div').first().click();" },
      { line: 4, text: "await page.locator('a').last().click();" },
    ]);
  });
});
