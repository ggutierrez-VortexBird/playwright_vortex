# Dockerfile — vortest-engine (motor de ejecución de Playwright).
#
# Sigue basado en la imagen oficial de Playwright (trae Chromium/Firefox/WebKit
# y sus dependencias de sistema preinstaladas) porque este es el único servicio
# del repo que realmente lanza navegadores en producción.
#
# Multi-stage: "builder" instala TODAS las dependencias (incluye
# @nestjs/cli, ts-node, jest, typescript) y compila a dist/; "runner" solo
# trae dependencias de producción (`npm ci --omit=dev`) + dist/ — a
# diferencia de vortest-web, acá SÍ aplica el patrón completo porque este
# Dockerfile corre `node dist/main.js` (build real), sin override de
# `command:` en el compose.
#
# tini como ENTRYPOINT: Node como PID 1 no reapea procesos zombie
# ni propaga señales a sus hijos correctamente — este proceso hace `spawn()`
# de `playwright test` como child process, así que necesita un init real.
#
# La versión del tag DEBE coincidir con la de `@playwright/test` en
# package.json (hoy 1.62.1) — verificado automáticamente por
# `npm run verify:playwright`. Debe coincidir además con
# vortest-web/Dockerfile mientras ambos compartan versión de Playwright.

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner
WORKDIR /app

# tini: no está en la imagen base de Playwright, se instala con apt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# El motor lanza `playwright test --config=/app/playwright.config.ts` como
# proceso hijo y el config carga el reporter desde /app/scripts/my-reporter.js:
# ambos se leen en RUNTIME, no los compila `nest build`, así que hay que
# copiarlos explícitamente. Sin ellos Playwright falla al instante con
# "playwright.config.ts does not exist", no emite ni un evento y la ejecución
# termina en errorMotor con "no generó pasos".
COPY playwright.config.ts ./playwright.config.ts
COPY scripts ./scripts

# La imagen base de Playwright NO trae un usuario `node` (a diferencia
# de las imágenes oficiales `node:*`) — trae `pwuser` (uid 1001), pensado
# para correr navegadores sin privilegios. `runtime/` es scratch del motor
# (runner.ts/script-writer.ts/storage-state.ts crean subdirectorios ahí en
# caliente) — se le da ownership de escritura SOLO a esa carpeta, no a todo
# /app: un `chown -R` sobre /app completo forzaría a Docker a copiar de
# nuevo cada archivo de node_modules/dist en esta capa (duplicando el peso
# de la imagen en vez de reducirlo — se detectó exactamente ese efecto al
# medir el tamaño antes/después, ver el reporte de esta corrección).
RUN mkdir -p /app/runtime \
    && chown -R pwuser:pwuser /app/runtime
USER pwuser

# 3001 = servidor HTTP interno (health check, cancelación). La conexión a
# RabbitMQ no expone puerto propio en este contenedor (es un cliente saliente).
EXPOSE 3001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
