'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DetalhesTarefa {
  titulo: string
  descricao: string
  status: { label: string; color: string }
  prioridade: { label: string; color: string }
  atrasada: boolean
  campos: { label: string; value: string }[]
}

export function LinhaTarefa({
  detalhes,
  className,
  children,
}: {
  detalhes: DetalhesTarefa
  className?: string
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-slate-50 ${className ?? ''}`}
        onClick={(e) => {
          // Cliques nos botões de ação não abrem o popup.
          if ((e.target as HTMLElement).closest('button, a, form, input, select')) return
          setAberto(true)
        }}
      >
        {children}
      </tr>

      {aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setAberto(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes da tarefa ${detalhes.titulo}`}
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900">{detalhes.titulo}</h2>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ background: detalhes.status.color }}
                >
                  {detalhes.status.label}
                </span>
                <span
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ background: detalhes.prioridade.color }}
                >
                  {detalhes.prioridade.label}
                </span>
                {detalhes.atrasada && (
                  <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    atrasada
                  </span>
                )}
              </div>

              {detalhes.descricao && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{detalhes.descricao}</p>
              )}

              <dl className="mt-4 divide-y divide-slate-100 text-sm">
                {detalhes.campos.map((c) => (
                  <div key={c.label} className="flex justify-between gap-4 py-2">
                    <dt className="text-slate-500">{c.label}</dt>
                    <dd className="text-right font-medium text-slate-900">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
