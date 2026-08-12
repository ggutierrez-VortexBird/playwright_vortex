'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export async function ejecutarCaso(casoId: string) {
  const res = await fetch('/api/ejecuciones', {
    method: 'POST',
    body: JSON.stringify({ casoPruebaId: casoId }),
  })
  if (!res.ok) {
    if (res.status === 409) throw new Error('YA_EXISTE_EJECUCION_EN_CURSO')
    throw new Error('ERROR_DESCONOCIDO')
  }
  return res.json()
}

export function EjecutarCasoButton({ casoId }: { casoId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      await ejecutarCaso(casoId)
      router.push('/ejecuciones')
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'YA_EXISTE_EJECUCION_EN_CURSO') {
        alert('Ya hay una ejecución en curso para este caso')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1 text-sm bg-[--client] text-white rounded hover:opacity-90 disabled:opacity-50"
    >
      {loading ? 'Ejecutando...' : 'Ejecutar'}
    </button>
  )
}
