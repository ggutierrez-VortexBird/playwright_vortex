// Verifica que la versión de @playwright/test instalada coincida con el tag
// de la imagen base pinneada en el Dockerfile de este proyecto. Ambos deben
// coincidir siempre: Playwright exige coincidencia estricta entre la
// librería npm y los binarios de navegador de la imagen.
const fs = require('fs')
const path = require('path')

const pkg = require('@playwright/test/package.json')
const dockerfilePath = path.resolve(__dirname, '..', 'Dockerfile')
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8')
const tag = dockerfile.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/)?.[1]

if (!tag) {
  console.error(`No se pudo extraer la versión del tag de Playwright en ${dockerfilePath}`)
  process.exit(1)
}

if (tag !== pkg.version) {
  console.error(`Desalineado: @playwright/test=${pkg.version} imagen Docker=${tag}`)
  process.exit(1)
}

console.log(`OK: @playwright/test y la imagen Docker coinciden en la versión ${pkg.version}`)
