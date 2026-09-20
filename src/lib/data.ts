import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Role, Setor, UsuarioLogado } from '@/lib/types'

type UsuarioComSetor = Omit<
  UsuarioLogado,
  'setor_nome' | 'empresa_nome' | 'empresas' | 'plataforma_admin'
> & { setores: Pick<Setor, 'nome'> | null }

/**
 * Retorna o vínculo (linha de `usuarios`) da pessoa autenticada na empresa
 * ativa, já com o nome do setor, da empresa e a lista de empresas onde ela
 * tem acesso. A empresa ativa é resolvida no banco (cabeçalho x-empresa-id
 * validado por current_empresa_id()), então a RLS já devolve só o vínculo
 * correto. Retorna null se o auth.users não tiver (ainda) um vínculo em
 * `usuarios` — ver link_usuario_on_signup() nas migrations.
 *
 * Memoizado por requisição (várias páginas/ações chamam esta função).
 */
export const getUsuarioLogado = cache(async (): Promise<UsuarioLogado | null> => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user) {
    if (authError) console.error('[getUsuarioLogado] sessão inválida:', authError.message)
    return null
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*, setores(nome)')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) console.error('[getUsuarioLogado] erro ao buscar usuário:', error.message)
  if (!data) return null

  const [{ data: empresasData }, { data: plataforma }] = await Promise.all([
    supabase.rpc('minhas_empresas'),
    supabase.rpc('is_plataforma_admin'),
  ])
  const empresas = ((empresasData ?? []) as { id: string; nome: string; role: Role }[]).map((e) => ({
    id: e.id,
    nome: e.nome,
    role: e.role,
  }))

  const { setores, ...usuario } = data as UsuarioComSetor
  return {
    ...usuario,
    setor_nome: setores?.nome ?? null,
    empresa_nome: empresas.find((e) => e.id === usuario.empresa_id)?.nome ?? '',
    empresas,
    plataforma_admin: plataforma === true,
  }
})
