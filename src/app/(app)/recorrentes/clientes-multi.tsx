'use client'

import { useState } from 'react'
import type { Cliente } from '@/lib/types'

export function ClientesMulti({ clientes }: { clientes: Cliente[] }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  return (
    <div className="rounded-lg border border-slate-300 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Clientes{' '}
          <span className="text-slate-400">
            (uma tarefa recorrente é criada para cada um; sem seleção, fica sem cliente)
          </span>
        </p>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMarcados(new Set(clientes.map((c) => c.id)))}
            className="text-slate-600 underline hover:text-slate-900"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setMarcados(new Set())}
            className="text-slate-600 underline hover:text-slate-900"
          >
            Limpar
          </button>
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum cliente ativo cadastrado.</p>
      ) : (
        <div className="grid max-h-44 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">
          {clientes.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="cliente_ids"
                value={c.id}
                checked={marcados.has(c.id)}
                onChange={() => alternar(c.id)}
              />
              {c.nome}
            </label>
          ))}
        </div>
      )}

      {marcados.size > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {marcados.size} {marcados.size === 1 ? 'cliente selecionado' : 'clientes selecionados'}
        </p>
      )}
    </div>
  )
}
