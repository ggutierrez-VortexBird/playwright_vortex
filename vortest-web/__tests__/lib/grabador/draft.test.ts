import {
  encodeDraftQuery,
  decodeDraft,
  type GrabacionDraft,
} from "@/lib/grabador/draft";

const baseDraft: GrabacionDraft = {
  proyectoId: "proy-1",
  nombre: "Login flow",
  urlInicial: "https://example.com/login",
  ambiente: "QA",
  credencialId: "",
  parentCaseId: "",
  navegador: "chromium",
};

describe("lib/grabador/draft", () => {
  describe("encodeDraftQuery", () => {
    it("codifica todos los campos requeridos", () => {
      const qs = encodeDraftQuery(baseDraft);
      const params = new URLSearchParams(qs);
      expect(params.get("proyectoId")).toBe("proy-1");
      expect(params.get("nombre")).toBe("Login flow");
      expect(params.get("urlInicial")).toBe("https://example.com/login");
      expect(params.get("ambiente")).toBe("QA");
      expect(params.get("navegador")).toBe("chromium");
    });

    it("omite credencialId y parentCaseId cuando están vacíos", () => {
      const qs = encodeDraftQuery(baseDraft);
      const params = new URLSearchParams(qs);
      expect(params.has("credencialId")).toBe(false);
      expect(params.has("parentCaseId")).toBe(false);
    });

    it("incluye credencialId y parentCaseId cuando tienen valor", () => {
      const qs = encodeDraftQuery({
        ...baseDraft,
        credencialId: "cred-1",
        parentCaseId: "caso-padre-1",
      });
      const params = new URLSearchParams(qs);
      expect(params.get("credencialId")).toBe("cred-1");
      expect(params.get("parentCaseId")).toBe("caso-padre-1");
    });

    it("escapa URLs con caracteres especiales", () => {
      const draft = { ...baseDraft, urlInicial: "https://example.com/a?b=1&c=2" };
      const qs = encodeDraftQuery(draft);
      const params = new URLSearchParams(qs);
      expect(params.get("urlInicial")).toBe("https://example.com/a?b=1&c=2");
    });
  });

  describe("decodeDraft", () => {
    it("decodifica todos los campos requeridos", () => {
      const qs = encodeDraftQuery(baseDraft);
      const params = Object.fromEntries(new URLSearchParams(qs));
      const decoded = decodeDraft(params);
      expect(decoded).toEqual(baseDraft);
    });

    it("incluye credencialId y parentCaseId cuando vienen en el query", () => {
      const draft = { ...baseDraft, credencialId: "cred-1", parentCaseId: "caso-1" };
      const qs = encodeDraftQuery(draft);
      const params = Object.fromEntries(new URLSearchParams(qs));
      const decoded = decodeDraft(params);
      expect(decoded).toEqual(draft);
    });

    it("retorna null si falta un campo requerido (proyectoId)", () => {
      const params = {
        nombre: "x",
        urlInicial: "https://example.com",
        ambiente: "QA",
        navegador: "chromium",
      };
      expect(decodeDraft(params)).toBeNull();
    });

    it("retorna null si falta nombre", () => {
      const params = {
        proyectoId: "p",
        urlInicial: "https://example.com",
        ambiente: "QA",
        navegador: "chromium",
      };
      expect(decodeDraft(params)).toBeNull();
    });

    it("retorna null si ambiente es inválido", () => {
      const params = {
        proyectoId: "p",
        nombre: "n",
        urlInicial: "https://example.com",
        ambiente: "INVALID",
        navegador: "chromium",
      };
      expect(decodeDraft(params)).toBeNull();
    });

    it("retorna null si navegador es inválido", () => {
      const params = {
        proyectoId: "p",
        nombre: "n",
        urlInicial: "https://example.com",
        ambiente: "QA",
        navegador: "ie",
      };
      expect(decodeDraft(params)).toBeNull();
    });

    it("retorna null si falta urlInicial", () => {
      const params = {
        proyectoId: "p",
        nombre: "n",
        ambiente: "QA",
        navegador: "chromium",
      };
      expect(decodeDraft(params)).toBeNull();
    });
  });

  describe("roundtrip", () => {
    it("encode/decode preserva credencialId y parentCaseId no vacíos", () => {
      const draft: GrabacionDraft = {
        proyectoId: "p1",
        nombre: "Test",
        urlInicial: "https://acme.com",
        ambiente: "Staging",
        credencialId: "cred-x",
        parentCaseId: "caso-y",
        navegador: "firefox",
      };
      const qs = encodeDraftQuery(draft);
      const params = Object.fromEntries(new URLSearchParams(qs));
      expect(decodeDraft(params)).toEqual(draft);
    });
  });
});
