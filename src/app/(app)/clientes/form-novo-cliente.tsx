'use client'

import { useRef } from 'react'
import { criarCliente } from './actions'

export function FormNovoCliente() {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await criarCliente(formData)
        formRef.current?.reset()
      }}
      className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <input
        name="nome"
        placeholder="Nome do cliente"
        required
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Adicionar
      </button>
    </form>
  )
}
