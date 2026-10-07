# Plan: evidencias y actas en S3

Es el único cambio de arquitectura planificado. Hoy los videos, capturas, trazas y PDF de actas se guardan en el volumen `artefactos` de la web (`/app/storage/artefactos`). Este plan los lleva a S3 sin cambiar la interfaz ni los permisos.

## Objetivos

- Que el almacenamiento de evidencias no dependa del disco de un servidor.
- Adelantar el video en cualquier punto (lectura por rangos de bytes).
- Retener la evidencia según una política definida.
- Poder volver al almacenamiento local sin tocar código.

## Esquema

`Artefacto.path` y `Acta.rutaPdf` pasan a ser claves opacas, con un discriminador. La migración es aditiva (`DEFAULT 'local'`), así que nada de lo existente cambia:

```prisma
enum StorageBackend { local s3 }

model Artefacto {
  path            String          // local: ruta | s3: object key
  storageBackend  StorageBackend  @default(local)
}

model Acta {
  rutaPdf         String
  storageBackend  StorageBackend  @default(local)
}
```

## Capa de almacenamiento

```typescript
interface StorageDriver {
  write(key: string, stream: Readable, contentType: string): Promise<{ bytes: number }>
  read(key: string): Promise<Readable>
  getSignedReadUrl(key: string, opts: { expiresInSec: number }): Promise<string | null>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
}
```

Dos implementaciones elegidas según `storageBackend`: `LocalFsStorageDriver` (el comportamiento actual) y `S3StorageDriver` (`@aws-sdk/client-s3` y su presigner). La usan la subida interna (`/api/internal/artefactos/upload`) y la generación del Acta (`/api/ejecuciones/:id/acta`), en lugar de escribir con `fs`.

## Lectura de evidencias

`GET /api/artefactos/:id` valida el acceso al proyecto con `requireProyectoAccess` y luego, según el origen:

- **s3**: genera una URL firmada (≈5 min) y responde `302`. S3 resuelve los rangos de bytes.
- **local**: transmite el archivo y atiende `Range` con `206 Partial Content`.

La URL firmada se genera siempre **después** de comprobar el permiso.

## Migración de lo existente

Script `scripts/backfill-s3.ts`, manual, idempotente y reanudable. Por cada fila `local`:

1. Lee el archivo y compara su SHA-256 con la columna; si no coincide, deja la fila para revisión.
2. Lo sube a S3, lo vuelve a descargar y recalcula el hash (el `ETag` no es un MD5 fiable en subidas multiparte).
3. Recién entonces actualiza `path` y `storageBackend`.

Los archivos locales se conservan hasta completar un ciclo estable sobre S3. El script se prueba primero contra una copia de la base.

## Retención

Una regla de ciclo de vida del bucket pasa la evidencia a almacenamiento frío o la borra a los N días, sin código propio. N es una decisión de producto y legal, y se define antes de configurarla.

## Verificación

- Hash de todas las filas migradas.
- Una evidencia en S3 responde `302` a una URL con `Content-Type` y `Accept-Ranges` correctos, y un `Range` devuelve `206`.
- Un usuario sin acceso al proyecto recibe `403` sin que se genere ninguna URL.
- Con filas `local` y `s3` mezcladas, volver el valor por defecto a `local` no rompe nada.

## Variables nuevas

`S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (opcional, para un S3 compatible), y las credenciales de acceso, o un rol si corre en AWS.
