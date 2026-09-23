'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { anexarArquivos, excluirAnexo, salvarDevolutiva } from './actions'

export interface DetalheAnexo {
  id: string
  nome: string
  tamanho: string
  enviadoPor: string
  enviadoEm: string
  podeExcluir: boolean
}

export interface DetalhesTarefa {
  tarefaId: string
  titulo: string
  descricao: string
  status: { label: string; color: string }
  prioridade: { label: string; color: string }
  atrasada: boolean
  campos: { label: string; value: string }[]
  anexos: DetalheAnexo[]
  podeAnexar: boolean
  devolutiva: string | null
  podeEditarDevolutiva: boolean
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
              className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
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

              <SecaoDevolutiva
                tarefaId={detalhes.tarefaId}
                devolutiva={detalhes.devolutiva}
                podeEditar={detalhes.podeEditarDevolutiva}
              />

              <SecaoAnexos
                tarefaId={detalhes.tarefaId}
                anexos={detalhes.anexos}
                podeAnexar={detalhes.podeAnexar}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function SecaoDevolutiva({
  tarefaId,
  devolutiva,
  podeEditar,
}: {
  tarefaId: string
  devolutiva: string | null
  podeEditar: boolean
}) {
  if (!podeEditar && !devolutiva) return null

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-medium text-slate-900">Devolutiva</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Explicação extra sobre o andamento ou a conclusão da tarefa (opcional).
      </p>

      {podeEditar ? (
        <form action={salvarDevolutiva.bind(null, tarefaId)} className="mt-2 space-y-2">
          <textarea
            key={devolutiva ?? ''}
            name="devolutiva"
            defaultValue={devolutiva ?? ''}
            rows={3}
            placeholder="Ex.: concluído com atraso porque o cliente enviou os documentos fora do prazo…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
            Salvar devolutiva
          </button>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{devolutiva}</p>
      )}
    </div>
  )
}

function SecaoAnexos({
  tarefaId,
  anexos,
  podeAnexar,
}: {
  tarefaId: string
  anexos: DetalheAnexo[]
  podeAnexar: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-medium text-slate-900">Documentos</h3>

      {anexos.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Nenhum documento anexado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <a
                  href={`/api/anexos/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-slate-700 hover:underline"
                  title={a.nome}
                >
                  {a.nome}
                </a>
                <p className="text-xs text-slate-400">
                  {a.tamanho} · enviado por {a.enviadoPor} em {a.enviadoEm}
                </p>
              </div>
              {a.podeExcluir && (
                <form
                  action={excluirAnexo.bind(null, a.id)}
                  onSubmit={(e) => {
                    if (!confirm(`Excluir o documento "${a.nome}"?`)) e.preventDefault()
                  }}
                >
                  <button className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    Excluir
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeAnexar && (
        <form
          ref={formRef}
          action={async (formData) => {
            await anexarArquivos(tarefaId, formData)
            formRef.current?.reset()
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            name="arquivos"
            multiple
            required
            className="flex-1 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
            Anexar
          </button>
          <p className="w-full text-[11px] text-slate-400">
            Até 20 MB por arquivo. PDF, imagens, Word, Excel, texto ou ZIP.
          </p>
        </form>
      )}
    </div>
  )
}
