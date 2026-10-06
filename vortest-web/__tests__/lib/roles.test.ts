import { ROL_LABEL, type RolUsuario } from "@/lib/roles";

describe("lib/roles", () => {
  it("expone las tres etiquetas de rol", () => {
    expect(ROL_LABEL.superadmin).toBe("Superadmin");
    expect(ROL_LABEL.admin).toBe("Admin");
    expect(ROL_LABEL.tester).toBe("Tester");
  });

  it("ROL_LABEL cubre todos los miembros de RolUsuario", () => {
    const roles: RolUsuario[] = ["superadmin", "admin", "tester"];
    for (const r of roles) {
      expect(typeof ROL_LABEL[r]).toBe("string");
      expect(ROL_LABEL[r].length).toBeGreaterThan(0);
    }
  });
});
