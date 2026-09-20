// Tipos alinhados com supabase/migrations/20250101000000_init_schema.sql
// Se o schema mudar, atualize este arquivo (ou gere via `supabase gen types typescript`).

export type Role = 'admin' | 'comum'
export type ResponsavelTipo = 'usuario' | 'setor'
export type Frequencia = 'diaria' | 'semanal' | 'mensal'
export type Prioridade = 'baixa' | 'media' | 'alta'
export type StatusTarefa = 'pendente' | 'andamento' | 'concluida' | 'cancelada'
export type TipoTarefa = 'avulsa' | 'recorrente'

export interface Empresa {
  id: string
  nome: string
  cnpj: string | null
  proprietario: string | null
  email_admin: string | null
  ativa: boolean
  created_at: string
}

export interface Setor {
  id: string
  empresa_id: string
  nome: string
  ativo: boolean
  exemplo: boolean
  created_at: string
}

export interface Cliente {
  id: string
  empresa_id: string
  nome: string
  ativo: boolean
  exemplo: boolean
  created_at: string
}

export interface Usuario {
  id: string
  empresa_id: string
  auth_user_id: string | null
  nome: string
  email: string | null
  whatsapp: string | null
  cargo: string | null
  setor_id: string | null
  role: Role
  ativo: boolean
  exemplo: boolean
  created_at: string
}

export interface Recorrente {
  id: string
  empresa_id: string
  titulo: string
  descricao: string
  setor_id: string
  cliente_id: string | null
  responsavel_tipo: ResponsavelTipo
  responsavel_id: string | null
  frequencia: Frequencia
  dias_semana: number[]
  dia_mes: number | null
  prazo_hora: string
  meta_hora: string | null
  prioridade: Prioridade
  ativo: boolean
  exemplo: boolean
  created_at: string
}

export interface Tarefa {
  id: string
  empresa_id: string
  titulo: string
  descricao: string
  tipo: TipoTarefa
  recorrente_id: string | null
  competencia: string | null
  cliente_id: string | null
  setor_id: string
  responsavel_tipo: ResponsavelTipo
  responsavel_id: string | null
  prioridade: Prioridade
  status: StatusTarefa
  prazo: string
  meta: string | null
  data_criacao: string
  data_inicio: string | null
  data_conclusao: string | null
  no_prazo: boolean | null
  no_meta: boolean | null
  criado_por: string | null
  concluido_por: string | null
  exemplo: boolean
}

export interface ConfigGeral {
  empresa_id: string
  webhook_url: string
  antecedencia_horas: number
  notificar_whatsapp: boolean
  updated_at: string
}

// Sessão do usuário logado, resolvida a partir de auth_user_id.
export interface UsuarioLogado extends Usuario {
  setor_nome: string | null
  empresa_id: string
  empresa_nome: string
  /** Empresas onde a pessoa tem vínculo ativo (alimenta o seletor). */
  empresas: { id: string; nome: string; role: Role }[]
  /** Dono da plataforma: pode criar e gerir empresas. */
  plataforma_admin: boolean
}
