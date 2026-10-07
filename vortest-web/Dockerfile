# Dockerfile — entorno de desarrollo (usado por docker-compose.dev.yml),
# HOY SOLO para el servicio `recorder` — es el único de los tres servicios de
# este proyecto que sigue lanzando navegadores (`playwright codegen`). `web`
# y `execution-consumer` usan `Dockerfile.slim` (node:24-slim, sin
# Playwright).
#
# Multi-stage: "deps" instala dependencias y genera el cliente de
# Prisma; "runner" copia ese resultado y corre como usuario no-root.
#
# DESVIACIÓN DOCUMENTADA respecto al "Cómo se hace" del plan: el patrón
# estándar de multi-stage (runner final con `npm ci --omit=dev`, solo
# `dist`/`.next`) NO se aplica acá, a propósito. Este Dockerfile solo corre
# en `docker-compose.dev.yml`, y `recorder` ejecuta un comando de DESARROLLO
# (`node --import tsx scripts/recorder-worker.ts`) que necesita `tsx` —
# devDependency — en runtime. Omitir devDependencies rompería el servicio.
# Cuando exista una config de producción real,
# ESE Dockerfile sí debe hacer build real + `npm ci --omit=dev`.
#
# La versión del tag DEBE coincidir con la de `@playwright/test` en
# package.json (hoy 1.62.1) — verificado automáticamente por
# `npm run verify:playwright`.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS deps

WORKDIR /app

# Capa de dependencias separada del código fuente para aprovechar la
# cache de Docker: solo se reinstala si cambian package*.json.
COPY package.json package-lock.json ./
# El `postinstall` del proyecto corre `scripts/install-playwright-browsers.js`
# — necesita esa carpeta ya copiada o `npm ci` falla con MODULE_NOT_FOUND.
# HU-G34 (multi-browser): esos browsers ya vienen de fábrica en la imagen
# base, se deja el postinstall igual por si el proyecto corre fuera de ella.
# Nota: ese postinstall descarga Chromium en la cache de Playwright del
# usuario root de ESTA etapa (`deps`) si por algún motivo no lo detecta ya
# instalado — no se copia a la etapa `runner` (solo se copia /app), así que
# no infla la imagen final; en el peor caso solo agrega tiempo de build.
COPY scripts ./scripts
RUN npm ci

COPY . .

# Genera el cliente de Prisma contra el schema copiado. No corre
# migraciones acá — eso lo hace el servicio `web` al arrancar, cuando ya
# tiene DATABASE_URL y la base está healthy (ver docker-compose.dev.yml).
RUN npx prisma generate

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner

WORKDIR /app

COPY --from=deps /app ./

# La imagen base de Playwright NO trae un usuario `node` (a diferencia
# de las imágenes oficiales `node:*`) — trae `pwuser` (uid 1001), pensado
# para correr navegadores sin privilegios. Se crean acá los directorios que
# este servicio escribe (volumen de scripts de Playwright, storage local) y
# se les da ownership de escritura, para que Docker inicialice cualquier
# volumen nombrado montado sobre ellos con permisos correctos para el
# usuario no-root. OJO: el chown es SOLO sobre esas carpetas puntuales, no
# sobre /app entero — hacerlo sobre todo /app forzaría a Docker a copiar de
# nuevo cada archivo de node_modules en esta capa, duplicando el peso de la
# imagen (se midió ese efecto exacto al comparar tamaños, ver el reporte de
# esta corrección).
RUN mkdir -p /app/playwright-scripts /app/storage/actas /app/storage/artefactos \
    && chown -R pwuser:pwuser /app/playwright-scripts /app/storage
USER pwuser

# 3000 = Next.js (no usado por `recorder`), 3100 = recorder-worker (HTTP
# interno + WS).
EXPOSE 3000 3100

# Sin CMD por default: docker-compose.dev.yml fija `command:` explícito
# por servicio. Definir un default acá solo escondería un compose mal
# configurado.
