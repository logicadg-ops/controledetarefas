import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Lê/grava a sessão nos cookies da requisição (padrão @supabase/ssr).
 */
export const EMPRESA_COOKIE = 'empresa_id'

export async function createClient() {
  const cookieStore = await cookies()

  // Empresa ativa da sessão. O banco valida contra os vínculos da pessoa
  // (ver current_empresa_id()), então um valor forjado não dá acesso a nada.
  const empresaId = cookieStore.get(EMPRESA_COOKIE)?.value

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: empresaId ? { 'x-empresa-id': empresaId } : {} },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // chamado de um Server Component sem permissão de escrita;
            // o middleware cuida do refresh da sessão nesse caso.
          }
        },
      },
    }
  )
}

/**
 * Cliente com a service role key — ignora RLS. Usar SOMENTE em Server
 * Actions/Route Handlers administrativas (ex: convidar usuário via
 * Supabase Auth). NUNCA expor esta chave ao navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
