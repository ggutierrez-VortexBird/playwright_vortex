import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@admin.com";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD no está definida en las variables de entorno");
  }

  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario ${email} ya existe. Saltando seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: "superadmin",
    },
  });

  console.log(`Usuario superadmin creado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
