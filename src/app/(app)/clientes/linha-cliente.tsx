'use client'

import { useState } from 'react'
import type { Cliente } from '@/lib/types'
import { cn } from '@/lib/utils'
import { alternarCliente, atualizarCliente, excluirCliente } from './actions'

export function LinhaCliente({ cliente: c }: { cliente: Cliente }) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <form
        action={async (formData) => {
          await atualizarCliente(c.id, formData)
          setEditando(false)
        }}
        className="flex items-center gap-2 px-4 py-3"
      >
        <input
          name="nome"
          defaultValue={c.nome}
          required
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{c.nome}</p>
        {c.exemplo && <p className="text-xs text-slate-400">exemplo</p>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Editar
        </button>
        <form
          action={excluirCliente.bind(null, c.id)}
          onSubmit={(e) => {
            if (
              !confirm(
                `Excluir o cliente "${c.nome}"? As tarefas dele permanecem, mas perdem o vínculo e saem do relatório de tempo por cliente. Para só ocultá-lo, use "Inativo".`
              )
            ) {
              e.preventDefault()
            }
          }}
        >
          <button className="rounded-full px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
            Excluir
          </button>
        </form>
        <form action={alternarCliente.bind(null, c.id, c.ativo)}>
          <button
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              c.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {c.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </form>
      </div>
    </div>
  )
}
