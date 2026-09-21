import Link from 'next/link'
import { AtualizacaoAutomatica } from '../atualizacao-automatica'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Tarefa, Setor, Usuario } from '@/lib/types'
import { STATUS_COLOR, STATUS_LABEL, formatDuracao, isAtrasada, tempoExecucaoMs } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const OFFSET_BRT_HORAS = 3

// Mês de referência ("YYYY-MM") = mês do prazo das tarefas, no fuso de Brasília.
function mesAtualBrt() {
  const d = new Date(Date.now() - OFFSET_BRT_HORAS * 3600 * 1000)
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
}

function chaveMes(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesParam } = await searchParams
  const supabase = await createClient()
  const usuario = await getUsuarioLogado()

  const atualBrt = mesAtualBrt()
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mesParam ?? '')
  const ano = m ? Number(m[1]) : atualBrt.ano
  const mes = m ? Number(m[2]) : atualBrt.mes
  const chave = chaveMes(ano, mes)
  const ehMesAtual = ano === atualBrt.ano && mes === atualBrt.mes
  const anterior = mes === 1 ? chaveMes(ano - 1, 12) : chaveMes(ano, mes - 1)
  const proximo = mes === 12 ? chaveMes(ano + 1, 1) : chaveMes(ano, mes + 1)
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1, OFFSET_BRT_HORAS))
  const inicioProxMes = new Date(Date.UTC(ano, mes, 1, OFFSET_BRT_HORAS))

  // RLS já limita o resultado ao que este usuário pode ver (tudo, se admin).
  // Só entram as tarefas com prazo dentro do mês selecionado.
  const { data: tarefasData } = await supabase
    .from('tarefas')
    .select('*')
    .gte('prazo', inicioMes.toISOString())
    .lt('prazo', inicioProxMes.toISOString())
  const tarefas = (tarefasData ?? []) as Tarefa[]

  const { data: setoresData } = await supabase.from('setores').select('*').eq('ativo', true)
  const setores = (setoresData ?? []) as Setor[]

  const { data: usuariosData } = await supabase.from('usuarios').select('id, nome')
  const usuarios = (usuariosData ?? []) as Pick<Usuario, 'id' | 'nome'>[]

  const { data: clientesData } = await supabase.from('clientes').select('id, nome')
  const clientes = (clientesData ?? []) as Pick<Cliente, 'id' | 'nome'>[]

  const total = tarefas.length
  const concluidas = tarefas.filter((t) => t.status === 'concluida')
  const atrasadas = tarefas.filter(isAtrasada)
  const pendentes = tarefas.filter((t) => t.status === 'pendente' || t.status === 'andamento')
  const noPrazo = concluidas.filter((t) => t.no_prazo === true)
  const pctNoPrazo = concluidas.length > 0 ? Math.round((noPrazo.length / concluidas.length) * 100) : null

  const concluidasComMeta = concluidas.filter((t) => t.meta !== null)
  const naMeta = concluidasComMeta.filter((t) => t.no_meta === true)
  const pctNaMeta =
    concluidasComMeta.length > 0 ? Math.round((naMeta.length / concluidasComMeta.length) * 100) : null

  const temposExecucao = concluidas
    .map(tempoExecucaoMs)
    .filter((ms): ms is number => ms !== null)
  const tempoMedioExecucaoMs =
    temposExecucao.length > 0 ? temposExecucao.reduce((a, b) => a + b, 0) / temposExecucao.length : null

  const porStatus = (['pendente', 'andamento', 'concluida', 'cancelada'] as const).map((s) => ({
    status: s,
    total: tarefas.filter((t) => t.status === s).length,
  }))

  const porSetor = setores
    .map((s) => ({ nome: s.nome, total: tarefas.filter((t) => t.setor_id === s.id).length }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxSetor = Math.max(1, ...porSetor.map((s) => s.total))

  const porUsuario = usuarios
    .map((u) => {
      const doUsuario = tarefas.filter((t) => t.responsavel_tipo === 'usuario' && t.responsavel_id === u.id)
      return {
        id: u.id,
        nome: u.nome,
        total: doUsuario.length,
        emAberto: doUsuario.filter((t) => t.status === 'pendente' || t.status === 'andamento').length,
        concluidas: doUsuario.filter((t) => t.status === 'concluida').length,
        atrasadas: doUsuario.filter(isAtrasada).length,
        tempoMs: doUsuario
          .map(tempoExecucaoMs)
          .filter((ms): ms is number => ms !== null)
          .reduce((a, b) => a + b, 0),
      }
    })
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
  const TOP_RANKING = 8
  const porCliente = clientes
    .map((c) => {
      const doCliente = tarefas.filter((t) => t.cliente_id === c.id)
      return {
        id: c.id,
        nome: c.nome,
        total: doCliente.length,
        emAberto: doCliente.filter((t) => t.status === 'pendente' || t.status === 'andamento').length,
        concluidas: doCliente.filter((t) => t.status === 'concluida').length,
        atrasadas: doCliente.filter(isAtrasada).length,
        tempoMs: doCliente
          .map(tempoExecucaoMs)
          .filter((ms): ms is number => ms !== null)
          .reduce((a, b) => a + b, 0),
      }
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
  const graficoTarefas = porCliente.slice(0, TOP_RANKING).map((c) => ({
    id: c.id,
    nome: c.nome,
    valor: c.total,
    rotulo: String(c.total),
    href: `/tarefas?cliente=${c.id}&mes=${chave}`,
  }))
  const graficoTempo = [...porCliente]
    .filter((c) => c.tempoMs > 0)
    .sort((a, b) => b.tempoMs - a.tempoMs)
    .slice(0, TOP_RANKING)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: c.tempoMs,
      rotulo: formatDuracao(c.tempoMs),
      href: `/tarefas?cliente=${c.id}&mes=${chave}`,
    }))
  const semCliente = tarefas.filter((t) => t.cliente_id === null).length
  // Só o administrador pode filtrar tarefas por usuário; para os demais as barras não são links.
  const hrefUsuario = (id: string) => (usuario?.role === 'admin' ? `/tarefas?usuario=${id}&mes=${chave}` : undefined)
  const graficoTarefasUsuario = porUsuario.slice(0, TOP_RANKING).map((u) => ({
    id: u.id,
    nome: u.nome,
    valor: u.total,
    rotulo: String(u.total),
    href: hrefUsuario(u.id),
  }))
  const graficoTempoUsuario = [...porUsuario]
    .filter((u) => u.tempoMs > 0)
    .sort((a, b) => b.tempoMs - a.tempoMs)
    .slice(0, TOP_RANKING)
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      valor: u.tempoMs,
      rotulo: formatDuracao(u.tempoMs),
      href: hrefUsuario(u.id),
    }))
  const totalDoSetor = tarefas.filter((t) => t.responsavel_tipo === 'setor').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-baseline gap-3 text-lg font-semibold text-slate-900">
            Olá, {usuario?.nome?.split(' ')[0] ?? ''}
            <AtualizacaoAutomatica intervaloSegundos={30} />
          </h1>
          <p className="text-sm text-slate-500">
            {usuario?.role === 'admin'
              ? 'Visão geral de todas as tarefas da equipe'
              : 'Suas tarefas e as do seu setor'}{' '}
            com prazo em{' '}
            <span className="font-medium text-slate-700">
              {MESES[mes - 1]} de {ano}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard?mes=${anterior}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Mês anterior"
          >
            ←
          </Link>
          <form action="/dashboard" className="flex items-center gap-1.5">
            <input
              type="month"
              name="mes"
              defaultValue={chave}
              required
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
            />
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              Ir
            </button>
          </form>
          <Link
            href={`/dashboard?mes=${proximo}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Próximo mês"
          >
            →
          </Link>
          {!ehMesAtual && (
            <Link href="/dashboard" className="text-sm text-slate-500 underline hover:text-slate-700">
              Mês atual
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total de tarefas" value={total} />
        <Kpi label="Pendentes / em andamento" value={pendentes.length} />
        <Kpi label="Atrasadas" value={atrasadas.length} tone={atrasadas.length > 0 ? 'danger' : undefined} />
        <Kpi
          label="Concluídas no prazo"
          value={pctNoPrazo === null ? '—' : `${pctNoPrazo}%`}
          tone={pctNoPrazo !== null && pctNoPrazo < 70 ? 'danger' : 'success'}
        />
        <Kpi
          label="Concluídas na meta"
          value={pctNaMeta === null ? '—' : `${pctNaMeta}%`}
          tone={pctNaMeta !== null && pctNaMeta < 70 ? 'danger' : 'success'}
        />
        <Kpi
          label="Tempo médio de execução"
          value={tempoMedioExecucaoMs === null ? '—' : formatDuracao(tempoMedioExecucaoMs)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tarefas por status</h2>
          <div className="mt-4 flex items-center gap-6">
            <Donut porStatus={porStatus} total={total} />
            <ul className="space-y-1.5 text-sm">
              {porStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLOR[s.status] }}
                  />
                  <span className="text-slate-600">{STATUS_LABEL[s.status]}</span>
                  <span className="font-medium text-slate-900">{s.total}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tarefas por setor</h2>
          {porSetor.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Nenhuma tarefa ainda.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {porSetor.map((s) => (
                <div key={s.nome} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-slate-600">{s.nome}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-slate-800"
                      style={{ width: `${(s.total / maxSetor) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-medium text-slate-900">
                    {s.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tarefas por usuário</h2>
        {porUsuario.length > 0 && (
          <>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <Barras titulo="Quantidade de tarefas" itens={graficoTarefasUsuario} cor="bg-slate-800" />
              <Barras
                titulo="Tempo de execução"
                itens={graficoTempoUsuario}
                cor="bg-sky-600"
                vazio="Nenhuma tarefa concluída com o botão Iniciar ainda."
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Gráficos com os {TOP_RANKING} usuários de maior volume; a tabela abaixo lista todos. O tempo só conta
              tarefas que passaram por &ldquo;Iniciar&rdquo; antes de serem concluídas.
            </p>
          </>
        )}
        {porUsuario.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Nenhuma tarefa atribuída a usuários ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Usuário</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Em aberto</th>
                  <th className="px-4 py-2 text-right font-medium">Concluídas</th>
                  <th className="px-4 py-2 text-right font-medium">Tempo</th>
                  <th className="py-2 pl-4 text-right font-medium">Atrasadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {porUsuario.map((u) => (
                  <tr key={u.id} className={usuario?.role === 'admin' ? 'relative hover:bg-slate-50' : undefined}>
                    <td className="py-2 pr-4 text-slate-700">
                      {usuario?.role === 'admin' ? (
                        <Link
                          href={`/tarefas?usuario=${u.id}&mes=${chave}`}
                          className="after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          {u.nome}
                        </Link>
                      ) : (
                        u.nome
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">{u.total}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{u.emAberto}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{u.concluidas}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {u.tempoMs > 0 ? formatDuracao(u.tempoMs) : '—'}
                    </td>
                    <td
                      className={
                        'py-2 pl-4 text-right ' + (u.atrasadas > 0 ? 'font-medium text-red-600' : 'text-slate-400')
                      }
                    >
                      {u.atrasadas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalDoSetor > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {totalDoSetor} {totalDoSetor === 1 ? 'tarefa atribuída' : 'tarefas atribuídas'} a um setor inteiro não
            entra{totalDoSetor === 1 ? '' : 'm'} nesta contagem.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tarefas por cliente</h2>
        {porCliente.length > 0 && (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <Barras titulo="Quantidade de tarefas" itens={graficoTarefas} cor="bg-slate-800" />
            <Barras
              titulo="Tempo de execução"
              itens={graficoTempo}
              cor="bg-sky-600"
              vazio="Nenhuma tarefa concluída com o botão Iniciar ainda."
            />
          </div>
        )}
        {porCliente.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Gráficos com os {TOP_RANKING} clientes de maior volume; a tabela abaixo lista todos. O tempo só conta
            tarefas que passaram por &ldquo;Iniciar&rdquo; antes de serem concluídas.
          </p>
        )}
        {porCliente.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Nenhuma tarefa vinculada a clientes ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-slate-200 text-slate-900">
                <tr>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Total</th>
                  <th className="px-4 py-3 font-bold">Em aberto</th>
                  <th className="px-4 py-3 font-bold text-blue-600">Concluídas</th>
                  <th className="px-4 py-3 font-bold">Tempo</th>
                  <th className="px-4 py-3 font-bold text-red-600">Atrasadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {porCliente.map((c) => (
                  <tr key={c.id} className="relative odd:bg-slate-100 hover:bg-slate-200/60">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <Link
                        href={`/tarefas?cliente=${c.id}&mes=${chave}`}
                        className="after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.total}</td>
                    <td className="px-4 py-3 text-slate-700">{c.emAberto}</td>
                    <td className="px-4 py-3 text-blue-600">{c.concluidas}</td>
                    <td className="px-4 py-3 text-slate-700">{c.tempoMs > 0 ? formatDuracao(c.tempoMs) : '—'}</td>
                    <td className="px-4 py-3 text-red-600">{c.atrasadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {semCliente > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {semCliente} {semCliente === 1 ? 'tarefa sem cliente vinculado não entra' : 'tarefas sem cliente vinculado não entram'} nesta contagem.
          </p>
        )}
      </div>
    </div>
  )
}

function Barras({
  titulo,
  itens,
  cor,
  vazio = 'Sem dados.',
}: {
  titulo: string
  itens: { id: string; nome: string; valor: number; rotulo: string; href?: string }[]
  cor: string
  vazio?: string
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <div>
      <h3 className="text-xs font-medium uppercase text-slate-500">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{vazio}</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {itens.map((i) => {
            const conteudo = (
              <>
                <span className="w-32 shrink-0 truncate text-sm text-slate-600">{i.nome}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div className={`h-2.5 rounded-full ${cor}`} style={{ width: `${(i.valor / max) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-medium text-slate-900">{i.rotulo}</span>
              </>
            )
            return i.href ? (
              <Link
                key={i.id}
                href={i.href}
                className="flex items-center gap-3 rounded-md hover:bg-slate-50"
                title={`${i.nome}: ${i.rotulo}`}
              >
                {conteudo}
              </Link>
            ) : (
              <div key={i.id} className="flex items-center gap-3" title={`${i.nome}: ${i.rotulo}`}>
                {conteudo}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'danger' | 'success'
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold ' +
          (tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-900')
        }
      >
        {value}
      </p>
    </div>
  )
}

function Donut({
  porStatus,
  total,
}: {
  porStatus: { status: keyof typeof STATUS_COLOR; total: number }[]
  total: number
}) {
  let acc = 0
  const stops = porStatus
    .filter((s) => s.total > 0)
    .map((s) => {
      const start = (acc / Math.max(total, 1)) * 100
      acc += s.total
      const end = (acc / Math.max(total, 1)) * 100
      return `${STATUS_COLOR[s.status]} ${start}% ${end}%`
    })

  const gradient = stops.length > 0 ? stops.join(', ') : '#e2e8f0 0% 100%'

  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${gradient})` }}
    >
      <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-lg font-semibold text-slate-900">{total}</span>
        <span className="text-[10px] text-slate-400">tarefas</span>
      </div>
    </div>
  )
}
