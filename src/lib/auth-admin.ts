import { createAdminClient } from '@/lib/supabase/server'

/**
 * Procura, no Supabase Auth, o login de um e-mail (via service role).
 * Usado quando a pessoa já tem acesso por outra empresa: o vínculo novo
 * precisa apontar para o mesmo auth_user_id (a trigger de cadastro só age
 * na criação do login).
 */
export async function buscarAuthUserIdPorEmail(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const alvo = email.trim().toLowerCase()
  const porPagina = 200
  for (let pagina = 1; pagina <= 25; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: porPagina })
    if (error || !data) return null
    const achado = data.users.find((u) => u.email?.toLowerCase() === alvo)
    if (achado) return achado.id
    if (data.users.length < porPagina) return null
  }
  return null
}
