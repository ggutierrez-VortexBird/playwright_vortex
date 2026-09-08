// __tests__/lib/acta/render-pdf.test.ts
// HU-G19 — tests para el renderizado de PDF (con mocks de Playwright).

import { renderActaToPdf } from "@/lib/acta/render-pdf";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("renderActaToPdf", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acta-test-"));

  afterAll(() => {
    // best-effort cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("renderiza HTML a PDF usando Playwright y persiste en disco", async () => {
    const mockPlaywright = {
      chromium: {
        launch: jest.fn(async () => ({
          newPage: async () => ({
            setContent: jest.fn(async () => undefined),
            pdf: jest.fn(async () => Buffer.from("%PDF-1.4 fake")),
            close: jest.fn(async () => undefined),
          }),
          close: jest.fn(async () => undefined),
        })),
      },
    };

    const result = await renderActaToPdf({
      templateHtml: "<html><body>fake</body></html>",
      consecutivo: "ACE-2026-0001",
      outputDir: tmpDir,
      playwright: mockPlaywright as any,
    });

    expect(result.consecutivo).toBe("ACE-2026-0001");
    expect(result.pdfPath).toBe(path.join(tmpDir, "ACE-2026-0001.pdf"));
    expect(fs.existsSync(result.pdfPath)).toBe(true);
    expect(fs.readFileSync(result.pdfPath).toString("utf8")).toBe("%PDF-1.4 fake");

    expect(mockPlaywright.chromium.launch).toHaveBeenCalledTimes(1);
  });

  it("cierra page y browser aunque page.setContent lance error", async () => {
    const newPage = jest.fn(async () => ({
      setContent: jest.fn(async () => {
        throw new Error("setContent failed");
      }),
      pdf: jest.fn(),
      close: jest.fn(async () => undefined),
    }));
    const closeBrowser = jest.fn(async () => undefined);
    const mockPlaywright = {
      chromium: {
        launch: jest.fn(async () => ({
          newPage,
          close: closeBrowser,
        })),
      },
    };

    await expect(
      renderActaToPdf({
        templateHtml: "<html></html>",
        consecutivo: "ACE-2026-0002",
        outputDir: tmpDir,
        playwright: mockPlaywright as any,
      }),
    ).rejects.toThrow("setContent failed");

    // Page y browser deben haberse cerrado igual
    expect(newPage).toHaveBeenCalled();
    expect(closeBrowser).toHaveBeenCalled();
  });
});