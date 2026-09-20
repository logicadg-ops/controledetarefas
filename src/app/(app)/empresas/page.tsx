import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { trocarEmpresa } from '@/app/empresa/actions'
import type { Empresa } from '@/lib/types'
import { cn } from '@/lib/utils'
import { alternarEmpresa, criarEmpresa } from './actions'

export const dynamic = 'force-dynamic'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}) {
  const { erro, aviso } = await searchParams
  const usuario = await getUsuarioLogado()
  if (!usuario?.plataforma_admin) redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('empresas').select('*').order('nome')
  const empresas = (data ?? []) as Empresa[]
  const vinculadas = new Set(usuario.empresas.map((e) => e.id))

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Empresas</h1>
        <p className="text-sm text-slate-500">
          Cada empresa tem usuários, setores, clientes e tarefas totalmente separados. Ao criar uma empresa,
          você entra como administrador dela e o e-mail informado abaixo também.
        </p>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {aviso && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</div>}

      <form
        action={criarEmpresa}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <input name="nome" placeholder="Nome da empresa" required className={inputCls} />
        <input name="cnpj" placeholder="CNPJ (opcional)" className={inputCls} />
        <input name="proprietario" placeholder="Proprietário (opcional)" className={inputCls} />
        <input name="email_admin" type="email" placeholder="E-mail do administrador" className={inputCls} />
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-2">
          Criar empresa
        </button>
      </form>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {empresas.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {e.nome}
                {e.id === usuario.empresa_id && (
                  <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                    empresa atual
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {[e.cnpj, e.proprietario && `proprietário: ${e.proprietario}`, e.email_admin]
                  .filter(Boolean)
                  .join(' · ') || 'sem dados adicionais'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {e.id !== usuario.empresa_id && vinculadas.has(e.id) && e.ativa && (
                <form action={trocarEmpresa}>
                  <input type="hidden" name="empresa_id" value={e.id} />
                  <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    Entrar
                  </button>
                </form>
              )}
              <form action={alternarEmpresa.bind(null, e.id, e.ativa)}>
                <button
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    e.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {e.ativa ? 'Ativa' : 'Inativa'}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
