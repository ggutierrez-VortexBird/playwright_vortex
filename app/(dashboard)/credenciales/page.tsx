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
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Credenciales compartidas</h2>
        <span className="sub">Ambiente QA · 3 credenciales</span>
        <span className="spacer" />
        <button className="btn btn-primary">Agregar credencial</button>
      </div>

      <div className="card">
        {PLACEHOLDER_CREDS.map((cred) => (
          <div key={cred.nombre} className="cred-row">
            <div style={{ flex: 1 }}>
              <div className="nm">{cred.nombre}</div>
              <div className="dt">{cred.detalle}</div>
            </div>
            <span className={`pill ${cred.sesion === "activa" ? "p-pass" : "p-idle"}`}>
              {cred.sesion === "activa" ? "Sesión activa" : "Requiere ingreso"}
            </span>
            <button className="btn">
              {cred.sesion === "activa" ? "Renovar" : "Iniciar sesión"}
            </button>
          </div>
        ))}
      </div>

      <div className="note">
        <b>Lo que no se ve, a propósito:</b> nadie puede leer una contraseña
        desde aquí. La herramienta guarda la sesión cifrada y con vencimiento;
        el usuario la usa, no la conoce. Esa es la diferencia entre una
        credencial compartida y una contraseña compartida.
      </div>
    </div>
  )
}
