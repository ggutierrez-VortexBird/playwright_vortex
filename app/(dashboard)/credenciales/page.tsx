interface CredRow {
  nombre: string
  detalle: string
  sesion: "activa" | "requerida"
}

const PLACEHOLDER_CREDS: CredRow[] = [
  {
    nombre: "Usuario funcional",
    detalle: "qa.funcional · usada en 4 casos · sesión vence en 42 min",
    sesion: "activa",
  },
  {
    nombre: "Usuario operativo",
    detalle: "qa.operativo · usada en 2 casos · sin sesión",
    sesion: "requerida",
  },
  {
    nombre: "Usuario consulta",
    detalle: "qa.consulta · sin uso reciente",
    sesion: "requerida",
  },
]

export default function CredencialesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Credenciales compartidas</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">Ambiente QA · 3 credenciales</span>
        <span className="ml-auto" />
        <button className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 transition-opacity">Agregar credencial</button>
      </div>

      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
        {PLACEHOLDER_CREDS.map((cred) => (
          <div
            key={cred.nombre}
            className="flex items-center gap-3.5 border-b border-m3-outline-variant px-5 py-4 last:border-b-0"
          >
            <div className="flex-1">
              <div className="font-body text-body-md font-medium text-m3-on-surface">
                {cred.nombre}
              </div>
              <div className="mt-0.5 font-mono-code text-mono-code text-m3-on-surface-variant">
                {cred.detalle}
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-sm font-medium ${
                cred.sesion === "activa"
                  ? "bg-m3-tertiary-container/15 text-m3-on-tertiary-container border border-m3-tertiary-container/40"
                  : "bg-m3-surface-container-high text-m3-on-surface-variant"
              }`}
            >
              {cred.sesion === "activa" ? "Sesión activa" : "Requiere ingreso"}
            </span>
            <button className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high transition-colors">
              {cred.sesion === "activa" ? "Renovar" : "Iniciar sesión"}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-r border-l-2 border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3.5 font-body text-body-sm leading-relaxed text-m3-on-surface-variant">
        <b className="font-semibold text-m3-on-surface">Lo que no se ve, a propósito:</b> nadie puede leer una contraseña
        desde aquí. La herramienta guarda la sesión cifrada y con vencimiento;
        el usuario la usa, no la conoce. Esa es la diferencia entre una
        credencial compartida y una contraseña compartida.
      </div>
    </div>
  )
}
