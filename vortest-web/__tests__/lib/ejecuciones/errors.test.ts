import {
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
  EJECUCION_YA_TERMINADA_ERROR,
} from "@/lib/ejecuciones/errors";

describe("lib/ejecuciones/errors", () => {
  it("YA_EXISTE_EJECUCION_EN_CURSO_ERROR es un Error con marker 'YA_EXISTE_EJECUCION_EN_CURSO'", () => {
    expect(YA_EXISTE_EJECUCION_EN_CURSO_ERROR).toBeInstanceOf(Error);
    expect(YA_EXISTE_EJECUCION_EN_CURSO_ERROR.message).toBe(
      "YA_EXISTE_EJECUCION_EN_CURSO",
    );
  });

  it("EJECUCION_YA_TERMINADA_ERROR es un Error con marker 'EJECUCION_YA_TERMINADA'", () => {
    expect(EJECUCION_YA_TERMINADA_ERROR).toBeInstanceOf(Error);
    expect(EJECUCION_YA_TERMINADA_ERROR.message).toBe("EJECUCION_YA_TERMINADA");
  });

  it("los dos markers son instancias distintas (referencias diferentes)", () => {
    expect(YA_EXISTE_EJECUCION_EN_CURSO_ERROR).not.toBe(EJECUCION_YA_TERMINADA_ERROR);
  });
});
