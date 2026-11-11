# Motor de ejecución; el tag de Playwright debe coincidir con @playwright/test (npm run verify:playwright)

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner
WORKDIR /app

# tini como init: el motor lanza playwright test como proceso hijo
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# nest build no los compila y el motor los lee en runtime
COPY playwright.config.ts ./playwright.config.ts
COPY scripts ./scripts

# La imagen base trae pwuser, no node; chown solo de runtime/ para no duplicar capas
RUN mkdir -p /app/runtime \
    && chown -R pwuser:pwuser /app/runtime
USER pwuser

EXPOSE 3001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
