# Dockerfile — entorno de desarrollo (usado por docker-compose.dev.yml).
#
# Los tres servicios (app, worker, recorder) comparten esta misma imagen y
# solo cambian el `command:` en docker-compose.dev.yml. Se basa en la
# imagen oficial de Playwright porque ya trae Node, Chromium/Firefox/WebKit
# y todas sus dependencias de sistema instaladas — sin eso, "npm run dev"
# funciona pero cualquier ejecución de Playwright (worker de ejecución,
# recorder-worker) falla al primer `launch()` por faltar librerías del SO.
#
# La versión del tag DEBE coincidir con la de `@playwright/test` en
# package.json (hoy 1.62.1) — si se actualiza esa dependencia, actualizar
# también este tag.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Capa de dependencias separada del código fuente para aprovechar la
# cache de Docker: solo se reinstala si cambian package*.json.
COPY package.json package-lock.json ./
# El `postinstall` del proyecto corre `scripts/install-playwright-browsers.js`
# — necesita esa carpeta ya copiada o `npm ci` falla con MODULE_NOT_FOUND.
# HU-G34 (multi-browser): esos browsers ya vienen de fábrica en la imagen
# base, se deja el postinstall igual por si el proyecto corre fuera de ella.
COPY scripts ./scripts
RUN npm ci

COPY . .

# Genera el cliente de Prisma contra el schema copiado. No corre
# migraciones acá — eso lo hace el servicio `app` al arrancar, cuando ya
# tiene DATABASE_URL y la base está healthy (ver docker-compose.dev.yml).
RUN npx prisma generate

# 3000 = Next.js (app), 3100 = recorder-worker (HTTP interno + WS).
EXPOSE 3000 3100

# Sin CMD por default: docker-compose.dev.yml fija `command:` explícito
# por servicio (web / worker de ejecución / recorder). Definir un default
# acá solo escondería un compose mal configurado.
