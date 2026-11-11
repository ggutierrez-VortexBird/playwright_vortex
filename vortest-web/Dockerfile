# Imagen con navegadores, usada por el servicio recorder (dev)
# El tag de Playwright debe coincidir con @playwright/test (npm run verify:playwright)
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS deps

WORKDIR /app

# Dependencias separadas del código para aprovechar la caché
COPY package.json package-lock.json ./
# El postinstall necesita scripts/ ya copiado
COPY scripts ./scripts
RUN npm ci

COPY . .

# Las migraciones las aplica el servicio web al arrancar
RUN npx prisma generate

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner

WORKDIR /app

COPY --from=deps /app ./

# La imagen base trae pwuser, no node; chown solo de estas carpetas para no duplicar capas
RUN mkdir -p /app/playwright-scripts /app/storage/actas /app/storage/artefactos \
    && chown -R pwuser:pwuser /app/playwright-scripts /app/storage
USER pwuser

# 3000 = Next.js, 3100 = grabador (HTTP + WS)
EXPOSE 3000 3100

# El compose define el command de cada servicio
