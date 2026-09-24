import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Recorrente, Setor, Usuario } from '@/lib/types'
import { cn } from '@/lib/utils'
import { alternarRecorrente, criarRecorrente, excluirRecorrente } from './actions'
import { BotaoExcluir } from './botao-excluir'
import { ImportarPlanilha } from './importar-planilha'
import { RecorrenteForm } from './recorrente-form'

export const dynamic = 'force-dynamic'

export default async function RecorrentesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string; cliente?: string }>
}) {
  const { erro, aviso, cliente: filtroCliente } = await searchParams
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: r }, { data: s }, { data: u }, { data: c }] = await Promise.all([
    supabase
      .from('recorrentes')
      .select('*, setores(nome), responsavel:usuarios!recorrentes_responsavel_id_fkey(nome), clientes(nome)')
      .order('titulo'),
    supabase.from('setores').select('*').eq('ativo', true).order('nome'),
    supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
  ])
  const recorrentes = (r ?? []) as (Recorrente & {
    setores: { nome: string } | null
    responsavel: { nome: string } | null
    clientes: { nome: string } | null
  })[]
  const setores = (s ?? []) as Setor[]
  const usuarios = (u ?? []) as Usuario[]
  const clientes = (c ?? []) as Cliente[]

  // Filtro por cliente: as opções vêm dos clientes que realmente têm recorrência.
  const clientesComRecorrencia = Array.from(
    new Map(
      recorrentes.filter((x) => x.cliente_id && x.clientes).map((x) => [x.cliente_id as string, x.clientes!.nome])
    )
  ).sort((a, b) => a[1].localeCompare(b[1]))
  const temSemCliente = recorrentes.some((x) => !x.cliente_id)
  const visiveis = filtroCliente
    ? recorrentes.filter((x) => (filtroCliente === 'sem' ? !x.cliente_id : x.cliente_id === filtroCliente))
    : recorrentes

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tarefas recorrentes</h1>
        <p className="text-sm text-slate-500">
          A tarefa é criada ao cadastrar e recriada na virada do dia (diária), da semana (semanal)
          ou do mês (mensal).
        </p>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {aviso && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</div>}

      <RecorrenteForm
        action={criarRecorrente}
        setores={setores}
        usuarios={usuarios}
        clientes={clientes}
        submitLabel="Criar recorrência"
      />

      <ImportarPlanilha />

      <form action="/recorrentes" className="flex flex-wrap items-center gap-2">
        <select
          name="cliente"
          defaultValue={filtroCliente ?? ''}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          <option value="">Todos os clientes</option>
          {temSemCliente && <option value="sem">Sem cliente</option>}
          {clientesComRecorrencia.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Filtrar
        </button>
        {filtroCliente && (
          <Link href="/recorrentes" className="text-sm text-slate-500 underline hover:text-slate-700">
            Limpar
          </Link>
        )}
        <span className="text-sm text-slate-500">
          {filtroCliente
            ? `${visiveis.length} de ${recorrentes.length} recorrências`
            : `${recorrentes.length} ${recorrentes.length === 1 ? 'recorrência' : 'recorrências'}`}
        </span>
      </form>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {visiveis.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">Nenhuma recorrência encontrada.</p>
        )}
        {visiveis.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{r.titulo}</p>
              <p className="text-xs text-slate-500">
                {r.setores?.nome} · {r.responsavel?.nome ?? 'setor inteiro'} · {r.frequencia}
                {r.clientes?.nome && <> · cliente: {r.clientes.nome}</>}
                {r.meta_hora && <> · meta {r.meta_hora.slice(0, 5)}</>} · prazo{' '}
                {r.prazo_hora.slice(0, 5)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/recorrentes/${r.id}`}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Editar
              </Link>
              <BotaoExcluir action={excluirRecorrente.bind(null, r.id)} titulo={r.titulo} />
              <form action={alternarRecorrente.bind(null, r.id, r.ativo)}>
                <button
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    r.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {r.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
