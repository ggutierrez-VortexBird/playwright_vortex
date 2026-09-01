import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCredencialDemo } from "../lib/credenciales/seed";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@admin.com";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD no está definida en las variables de entorno");
  }

  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.usuario.create({
      data: {
        email,
        passwordHash,
        rol: "superadmin",
      },
    });
    console.log(`Usuario superadmin creado: ${email}`);
  } else {
    console.log(`Usuario ${email} ya existe. Saltando creación de usuario.`);
  }

  // HU-G22: crear Credencial de demo (storageState vacío) para que el modo
  // grabador funcione out-of-the-box. Idempotente: si ya existe, no duplica.
  const proyectoDemo = await prisma.proyecto.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (proyectoDemo) {
    await seedCredencialDemo(proyectoDemo.id);
    console.log(`Credencial demo sembrada en proyecto ${proyectoDemo.nombre}.`);
  } else {
    console.log(
      "Sin proyectos para sembrar credencial demo. Se creará al primer proyecto.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });