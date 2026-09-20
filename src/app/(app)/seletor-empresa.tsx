'use client'

import { trocarEmpresa } from '@/app/empresa/actions'

export function SeletorEmpresa({
  empresas,
  atual,
}: {
  empresas: { id: string; nome: string }[]
  atual: string
}) {
  return (
    <form action={trocarEmpresa}>
      <select
        name="empresa_id"
        defaultValue={atual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Empresa"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-800 focus:border-slate-400 focus:outline-none"
      >
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </form>
  )
}
