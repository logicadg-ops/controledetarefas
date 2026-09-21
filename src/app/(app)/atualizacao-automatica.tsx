'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Recarrega os dados da página em intervalos, para que novos lançamentos de
 * outros usuários apareçam sem apertar F5. Só age com a aba visível e com
 * internet; ao voltar para a aba, atualiza na hora se já passou o intervalo.
 * router.refresh() mantém filtros (URL), popups abertos e o que foi digitado.
 */
export function AtualizacaoAutomatica({ intervaloSegundos = 30 }: { intervaloSegundos?: number }) {
  const router = useRouter()
  const ultima = useRef(Date.now())
  const [hora, setHora] = useState<string | null>(null)

  useEffect(() => {
    const marcar = () => {
      ultima.current = Date.now()
      setHora(new Date().toLocaleTimeString('pt-BR'))
    }
    marcar()

    const atualizar = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      router.refresh()
      marcar()
    }

    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima.current > intervaloSegundos * 1000) {
        atualizar()
      }
    }

    const id = setInterval(atualizar, intervaloSegundos * 1000)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
    }
  }, [router, intervaloSegundos])

  return (
    <span className="text-xs text-slate-400" title={`Atualiza sozinho a cada ${intervaloSegundos} segundos`}>
      ● atualizado às {hora ?? '—'}
    </span>
  )
}
