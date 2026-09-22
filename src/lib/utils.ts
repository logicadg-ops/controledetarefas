import type { Prioridade, StatusTarefa, Tarefa } from './types'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export const STATUS_LABEL: Record<StatusTarefa, string> = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const STATUS_COLOR: Record<StatusTarefa, string> = {
  pendente: '#f59e0b',
  andamento: '#3b82f6',
  concluida: '#22c55e',
  cancelada: '#94a3b8',
}

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const PRIORIDADE_COLOR: Record<Prioridade, string> = {
  baixa: '#64748b',
  media: '#f59e0b',
  alta: '#ef4444',
}

export const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Uma tarefa está atrasada quando ainda não foi concluída/cancelada e o prazo já passou. */
export function isAtrasada(t: Pick<Tarefa, 'status' | 'prazo'>): boolean {
  if (t.status === 'concluida' || t.status === 'cancelada') return false
  return new Date(t.prazo).getTime() < Date.now()
}

/** Vence nas próximas 24h (e ainda não está atrasada). */
export function venceHoje(t: Pick<Tarefa, 'status' | 'prazo'>): boolean {
  if (t.status === 'concluida' || t.status === 'cancelada') return false
  const diff = new Date(t.prazo).getTime() - Date.now()
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000
}

/** Já passou da meta mas ainda não do prazo (e a tarefa segue em aberto). */
export function passouDaMeta(t: Pick<Tarefa, 'status' | 'prazo' | 'meta'>): boolean {
  if (t.status === 'concluida' || t.status === 'cancelada') return false
  if (!t.meta) return false
  return new Date(t.meta).getTime() < Date.now() && new Date(t.prazo).getTime() >= Date.now()
}

/** Tempo do fluxo de execução (Iniciar -> Concluir) em milissegundos, ou null se não medível. */
export function tempoExecucaoMs(t: Pick<Tarefa, 'data_inicio' | 'data_conclusao'>): number | null {
  if (!t.data_inicio || !t.data_conclusao) return null
  return new Date(t.data_conclusao).getTime() - new Date(t.data_inicio).getTime()
}

/** Formata bytes como "12 KB", "3,4 MB" etc. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB']
  let valor = bytes / 1024
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  return `${valor.toFixed(valor < 10 ? 1 : 0).replace('.', ',')} ${unidades[i]}`
}

/** Formata uma duração em milissegundos como "Xh Ymin", "Xmin" ou "Xd Yh". */
export function formatDuracao(ms: number): string {
  const minutos = Math.round(ms / 60000)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const restoMin = minutos % 60
  if (horas < 24) return restoMin > 0 ? `${horas}h ${restoMin}min` : `${horas}h`
  const dias = Math.floor(horas / 24)
  const restoHoras = horas % 24
  return restoHoras > 0 ? `${dias}d ${restoHoras}h` : `${dias}d`
}
