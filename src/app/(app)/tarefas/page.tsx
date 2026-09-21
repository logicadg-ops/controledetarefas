import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Prioridade, Setor, Tarefa, Usuario } from '@/lib/types'
import {
  PRIORIDADE_COLOR,
  PRIORIDADE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  cn,
  formatDateTime,
  formatDuracao,
  isAtrasada,
  passouDaMeta,
  tempoExecucaoMs,
} from '@/lib/utils'
import { AtualizacaoAutomatica } from '../atualizacao-automatica'
import { atualizarStatus, excluirTarefa } from './actions'
import { BotaoExcluirTarefa } from './botao-excluir-tarefa'
import { LinhaTarefa, type DetalhesTarefa } from './linha-tarefa'

export const dynamic = 'force-dynamic'

type Filtro = 'todas' | 'pendente' | 'andamento' | 'concluida' | 'atrasadas'

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{
    filtro?: Filtro
    mes?: string
    hoje?: string
    usuario?: string
    cliente?: string
    setor?: string
    prioridade?: string
  }>
}) {
  const { filtro = 'todas', mes, hoje, usuario: usuarioId, cliente: clienteId, setor: setorId, prioridade } =
    await searchParams
  // mes=1 -> mês atual; mes=YYYY-MM -> mês específico (vindo do Dashboard). Prazo em fuso de Brasília.
  const brt = new Date(Date.now() - 3 * 3600 * 1000)
  const mesSel = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes === '1' ? `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}` : (mes ?? ''))
  const esteMs = !!mesSel
  const soHoje = hoje === '1'
  const supabase = await createClient()
  const usuario = await getUsuarioLogado()

  // RLS já retorna só o que este usuário pode ver.
  const [{ data }, { data: u }, { data: c }, { data: s }] = await Promise.all([
    supabase
      .from('tarefas')
      .select('*, setores(nome), responsavel:usuarios!tarefas_responsavel_id_fkey(nome), clientes(nome)')
      .order('prazo', { ascending: true }),
    supabase.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('setores').select('id, nome').eq('ativo', true).order('nome'),
  ])
  const isAdmin = usuario?.role === 'admin'
  const usuarios = (u ?? []) as Pick<Usuario, 'id' | 'nome'>[]
  let clientes = (c ?? []) as Pick<Cliente, 'id' | 'nome'>[]
  let setores = (s ?? []) as Pick<Setor, 'id' | 'nome'>[]

  let tarefas = (data ?? []) as (Tarefa & {
    setores: { nome: string } | null
    responsavel: { nome: string } | null
    clientes: { nome: string } | null
  })[]

  // Usuário comum só enxerga o que é dele ou do setor dele (RLS); as opções de
  // cliente e setor também ficam limitadas a esse universo.
  if (!isAdmin) {
    const clientesVisiveis = new Set(tarefas.map((t) => t.cliente_id).filter(Boolean))
    clientes = clientes.filter((x) => clientesVisiveis.has(x.id))
    setores = setores.filter((x) => x.id === usuario?.setor_id)
  }

  if (filtro === 'atrasadas') {
    tarefas = tarefas.filter(isAtrasada)
  } else if (filtro !== 'todas') {
    tarefas = tarefas.filter((t) => t.status === filtro)
  }

  if (isAdmin && usuarioId) tarefas = tarefas.filter((t) => t.responsavel_id === usuarioId)
  if (clienteId) tarefas = tarefas.filter((t) => t.cliente_id === clienteId)
  if (setorId) tarefas = tarefas.filter((t) => t.setor_id === setorId)
  if (prioridade) tarefas = tarefas.filter((t) => t.prioridade === prioridade)

  if (mesSel) {
    const a = Number(mesSel[1])
    const m = Number(mesSel[2])
    const inicioMes = new Date(Date.UTC(a, m - 1, 1, 3))
    const inicioProxMes = new Date(Date.UTC(a, m, 1, 3))
    tarefas = tarefas.filter((t) => {
      const prazo = new Date(t.prazo)
      return prazo >= inicioMes && prazo < inicioProxMes
    })
  }


  // Tarefas cujo prazo ou meta cai no dia de hoje (fuso de Brasília).
  if (soHoje) {
    const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const hojeStr = dia(new Date())
    tarefas = tarefas.filter((t) => dia(new Date(t.prazo)) === hojeStr || (t.meta && dia(new Date(t.meta)) === hojeStr))
  }

  const simNao = (v: boolean | null) => (v === null ? '—' : v ? 'Sim' : 'Não')

  const detalhesDe = (t: (typeof tarefas)[number]): DetalhesTarefa => {
    const ms = tempoExecucaoMs(t)
    const concluida = t.status === 'concluida'
    return {
      titulo: t.titulo,
      descricao: t.descricao,
      status: { label: STATUS_LABEL[t.status], color: STATUS_COLOR[t.status] },
      prioridade: { label: PRIORIDADE_LABEL[t.prioridade], color: PRIORIDADE_COLOR[t.prioridade] },
      atrasada: isAtrasada(t),
      campos: [
        { label: 'Tipo', value: t.tipo === 'recorrente' ? 'Recorrente' : 'Avulsa' },
        { label: 'Cliente', value: t.clientes?.nome ?? '—' },
        { label: 'Setor', value: t.setores?.nome ?? '—' },
        {
          label: 'Responsável',
          value: t.responsavel_tipo === 'setor' ? `Setor: ${t.setores?.nome ?? '—'}` : (t.responsavel?.nome ?? '—'),
        },
        { label: 'Criada em', value: formatDateTime(t.data_criacao) },
        { label: 'Meta', value: formatDateTime(t.meta) },
        { label: 'Prazo', value: formatDateTime(t.prazo) },
        { label: 'Iniciada em', value: formatDateTime(t.data_inicio) },
        { label: 'Concluída em', value: formatDateTime(t.data_conclusao) },
        { label: 'Tempo de execução', value: ms !== null ? formatDuracao(ms) : '—' },
        ...(concluida
          ? [
              { label: 'Concluída no prazo', value: simNao(t.no_prazo) },
              { label: 'Concluída na meta', value: simNao(t.no_meta) },
            ]
          : []),
      ],
    }
  }

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'andamento', label: 'Em andamento' },
    { key: 'concluida', label: 'Concluídas' },
    { key: 'atrasadas', label: 'Atrasadas' },
  ]

  // Monta a URL preservando os demais filtros ativos.
  const href = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const atual: Record<string, string | undefined> = {
      filtro,
      mes: esteMs ? mes : undefined,
      hoje: soHoje ? '1' : undefined,
      usuario: isAdmin ? usuarioId : undefined,
      cliente: clienteId,
      setor: setorId,
      prioridade,
      ...over,
    }
    for (const [k, v] of Object.entries(atual)) if (v) params.set(k, v)
    return `/tarefas?${params.toString()}`
  }

  const selectCls =
    'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none'
  const temFiltroExtra = !!((isAdmin && usuarioId) || clienteId || setorId || prioridade)

  return (
    // 20% mais larga que o container padrão (max-w-6xl = 72rem -> 86.4rem),
    // centralizada e limitada à largura da tela.
    <div className="relative left-1/2 w-[max(100%,min(86.4rem,calc(100vw_-_3rem)))] -translate-x-1/2 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Tarefas</h1>
          <AtualizacaoAutomatica intervaloSegundos={20} />
        </div>
        <Link
          href="/tarefas/nova"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Nova tarefa
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {filtros.map((f) => (
            <Link
              key={f.key}
              href={href({ filtro: f.key })}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
                filtro === f.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          <Link
            href={href({ hoje: soHoje ? undefined : '1' })}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
              soHoje ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            )}
          >
            Hoje
          </Link>
          <Link
            href={href({ mes: esteMs ? undefined : '1' })}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
              esteMs ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            )}
          >
            Este mês
          </Link>
        </div>
      </div>

      <form action="/tarefas" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="filtro" value={filtro} />
        {esteMs && <input type="hidden" name="mes" value={mes} />}
        {soHoje && <input type="hidden" name="hoje" value="1" />}
        {isAdmin && (
          <select name="usuario" defaultValue={usuarioId ?? ''} className={selectCls}>
            <option value="">Todos os usuários</option>
            {usuarios.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        )}
        <select name="cliente" defaultValue={clienteId ?? ''} className={selectCls}>
          <option value="">Todos os clientes</option>
          {clientes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select name="setor" defaultValue={setorId ?? ''} className={selectCls}>
          <option value="">Todos os setores</option>
          {setores.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select name="prioridade" defaultValue={prioridade ?? ''} className={selectCls}>
          <option value="">Todas as prioridades</option>
          {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
            <option key={p} value={p}>
              {PRIORIDADE_LABEL[p]}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Filtrar
        </button>
        {temFiltroExtra && (
          <Link
            href={href({ usuario: undefined, cliente: undefined, setor: undefined, prioridade: undefined })}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {tarefas.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Nenhuma tarefa encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tarefa</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Setor</th>
                <th className="px-4 py-2.5 font-medium">Responsável</th>
                <th className="px-4 py-2.5 font-medium">Meta</th>
                <th className="px-4 py-2.5 font-medium">Prazo</th>
                <th className="px-4 py-2.5 font-medium">Prioridade</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Execução</th>
                <th className="px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tarefas.map((t) => (
                <LinhaTarefa key={t.id} detalhes={detalhesDe(t)} className={isAtrasada(t) ? 'bg-red-50/40' : undefined}>
                  <td className="min-w-[10rem] px-4 py-2.5">
                    <p className="font-medium text-slate-900">{t.titulo}</p>
                    {t.descricao && <p className="text-xs text-slate-400">{t.descricao}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{t.clientes?.nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.setores?.nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {t.responsavel_tipo === 'setor' ? `Setor: ${t.setores?.nome ?? '—'}` : t.responsavel?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatDateTime(t.meta)}
                    {passouDaMeta(t) && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        fora da meta
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatDateTime(t.prazo)}
                    {isAtrasada(t) && (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        atrasada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ background: PRIORIDADE_COLOR[t.prioridade] }}
                    >
                      {PRIORIDADE_LABEL[t.prioridade]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ background: STATUS_COLOR[t.status] }}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {(() => {
                      const ms = tempoExecucaoMs(t)
                      return ms !== null ? formatDuracao(ms) : '—'
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex gap-1.5">
                      {t.status === 'pendente' && (
                        <form action={atualizarStatus.bind(null, t.id, 'andamento')}>
                          <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                            Iniciar
                          </button>
                        </form>
                      )}
                      {(t.status === 'pendente' || t.status === 'andamento') && (
                        <>
                          <form action={atualizarStatus.bind(null, t.id, 'concluida')}>
                            <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">
                              Concluir
                            </button>
                          </form>
                          {usuario?.role === 'admin' && (
                            <form action={atualizarStatus.bind(null, t.id, 'cancelada')}>
                              <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                                Cancelar
                              </button>
                            </form>
                          )}
                        </>
                      )}
                      {t.status === 'concluida' && (
                        <form action={atualizarStatus.bind(null, t.id, 'pendente')}>
                          <button className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100">
                            Reabrir
                          </button>
                        </form>
                      )}
                      {isAdmin && t.status !== 'concluida' && (
                        <BotaoExcluirTarefa
                          action={excluirTarefa.bind(null, t.id)}
                          titulo={t.titulo}
                          recorrente={t.recorrente_id !== null}
                        />
                      )}
                    </div>
                  </td>
                </LinhaTarefa>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
