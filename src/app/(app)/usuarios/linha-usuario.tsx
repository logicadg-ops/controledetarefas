'use client'

import { useState } from 'react'
import type { Setor, Usuario } from '@/lib/types'
import { cn } from '@/lib/utils'
import { alternarUsuario, atualizarUsuario, convidarUsuario } from './actions'

export function LinhaUsuario({
  usuario: u,
  setores,
}: {
  usuario: Usuario & { setores: { nome: string } | null }
  setores: Setor[]
}) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <form
        action={async (formData) => {
          await atualizarUsuario(u.id, formData)
          setEditando(false)
        }}
        className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2"
      >
        <input
          name="nome"
          defaultValue={u.nome}
          required
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          name="cargo"
          defaultValue={u.cargo ?? ''}
          placeholder="Cargo"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          name="whatsapp"
          defaultValue={u.whatsapp ?? ''}
          placeholder="WhatsApp, ex.: 81999999999"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          name="setor_id"
          defaultValue={u.setor_id ?? ''}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Sem setor</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={u.role}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="comum">Usuário comum</option>
          <option value="admin">Administrador</option>
        </select>
        <div className="flex items-center gap-2 sm:col-span-2">
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
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {u.nome}{' '}
          <span
            className={cn(
              'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              u.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {u.role === 'admin' ? 'admin' : 'comum'}
          </span>
        </p>
        <p className="text-xs text-slate-500">
          {u.email} · {u.setores?.nome ?? 'sem setor'} ·{' '}
          {u.whatsapp ? (
            u.whatsapp
          ) : (
            <span className="text-amber-600" title="Sem WhatsApp, não recebe notificações">
              sem WhatsApp
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Editar
        </button>
        {!u.auth_user_id && u.email && (
          <form action={convidarUsuario.bind(null, u.email)}>
            <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
              Convidar
            </button>
          </form>
        )}
        {u.auth_user_id && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            acesso ativo
          </span>
        )}
        <form action={alternarUsuario.bind(null, u.id, u.ativo)}>
          <button
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {u.ativo ? 'Ativo' : 'Inativo'}
          </button>
        </form>
      </div>
    </div>
  )
}
