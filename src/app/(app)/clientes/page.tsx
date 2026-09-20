import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Tarefa } from '@/lib/types'
import { cn, formatDuracao, tempoExecucaoMs } from '@/lib/utils'
import { FormNovoCliente } from './form-novo-cliente'
import { LinhaCliente } from './linha-cliente'

export const dynamic = 'force-dynamic'

type Periodo = 'dia' | 'mes' | 'ano'

function inicioPeriodo(periodo: Periodo): Date {
  const agora = new Date()
  if (periodo === 'dia') {
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  }
  if (periodo === 'ano') {
    return new Date(agora.getFullYear(), 0, 1)
  }
  return new Date(agora.getFullYear(), agora.getMonth(), 1)
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: Periodo }>
}) {
  const { periodo = 'mes' } = await searchParams
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('clientes').select('*').order('nome')
  const clientes = (data ?? []) as Cliente[]

  const desde = inicioPeriodo(periodo)
  const { data: tarefasData } = await supabase
    .from('tarefas')
    .select('*')
    .eq('status', 'concluida')
    .not('cliente_id', 'is', null)
    .gte('data_conclusao', desde.toISOString())

  const tarefas = (tarefasData ?? []) as Tarefa[]

  const relatorio = clientes
    .map((c) => {
      const doCliente = tarefas.filter((t) => t.cliente_id === c.id)
      const tempos = doCliente.map(tempoExecucaoMs).filter((ms): ms is number => ms !== null)
      const tempoTotalMs = tempos.reduce((a, b) => a + b, 0)
      return {
        cliente: c,
        totalTarefas: doCliente.length,
        tempoTotalMs,
        tempoMedioMs: tempos.length > 0 ? tempoTotalMs / tempos.length : null,
      }
    })
    .filter((r) => r.totalTarefas > 0)
    .sort((a, b) => b.tempoTotalMs - a.tempoTotalMs)

  const periodos: { key: Periodo; label: string }[] = [
    { key: 'dia', label: 'Hoje' },
    { key: 'mes', label: 'Este mês' },
    { key: 'ano', label: 'Este ano' },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">
          Cadastre clientes para vincular às tarefas e medir o tempo demandado por cada um.
        </p>
      </div>

      <FormNovoCliente />

      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{clientes.length}</span>{' '}
        {clientes.length === 1 ? 'cliente' : 'clientes'} no total ·{' '}
        {clientes.filter((c) => c.ativo).length} {clientes.filter((c) => c.ativo).length === 1 ? 'ativo' : 'ativos'} ·{' '}
        {clientes.filter((c) => !c.ativo).length}{' '}
        {clientes.filter((c) => !c.ativo).length === 1 ? 'inativo' : 'inativos'}
      </p>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {clientes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Nenhum cliente cadastrado.</p>
        ) : (
          clientes.map((c) => <LinhaCliente key={c.id} cliente={c} />)
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Tempo demandado por cliente</h2>
          <div className="flex gap-1">
            {periodos.map((p) => (
              <a
                key={p.key}
                href={`/clientes?periodo=${p.key}`}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm',
                  periodo === p.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                )}
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {relatorio.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              Nenhuma tarefa concluída vinculada a um cliente nesse período.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Tarefas concluídas</th>
                  <th className="px-4 py-2.5 font-medium">Tempo total</th>
                  <th className="px-4 py-2.5 font-medium">Tempo médio/tarefa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatorio.map((r) => (
                  <tr key={r.cliente.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.cliente.nome}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.totalTarefas}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.tempoTotalMs > 0 ? formatDuracao(r.tempoTotalMs) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.tempoMedioMs !== null ? formatDuracao(r.tempoMedioMs) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-slate-400">
          O tempo só é contabilizado em tarefas que passaram pelo botão &ldquo;Iniciar&rdquo; antes de
          serem concluídas.
        </p>
      </div>
    </div>
  )
}
