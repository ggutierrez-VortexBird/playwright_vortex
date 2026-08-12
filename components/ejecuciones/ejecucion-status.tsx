export function EjecucionStatus({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pendiente: { label: 'Pendiente', className: 'pill-idle' },
    corriendo: { label: 'Corriendo', className: 'pill-corrriendo' },
    paso: { label: 'Pasó', className: 'pill-pass' },
    fallo: { label: 'Falló', className: 'pill-fail' },
    reparado: { label: 'Reparado', className: 'pill-heal' },
    errorMotor: { label: 'Error motor', className: 'pill-error' },
  }

  const { label, className } = config[estado] ?? { label: estado, className: 'pill-idle' }

  return <span className={`pill ${className}`}>{label}</span>
}
