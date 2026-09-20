import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Setor } from '@/lib/types'
import { cn } from '@/lib/utils'
import { alternarSetor, criarSetor } from './actions'

export const dynamic = 'force-dynamic'

export default async function SetoresPage() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('setores').select('*').order('nome')
  const setores = (data ?? []) as Setor[]

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Setores</h1>

      <form action={criarSetor} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          name="nome"
          placeholder="Nome do setor (ex: Portaria)"
          required
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Adicionar
        </button>
      </form>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {setores.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{s.nome}</p>
              {s.exemplo && <p className="text-xs text-slate-400">exemplo</p>}
            </div>
            <form action={alternarSetor.bind(null, s.id, s.ativo)}>
              <button
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  s.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                )}
              >
                {s.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
