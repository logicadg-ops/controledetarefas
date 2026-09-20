'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, EMPRESA_COOKIE } from '@/lib/supabase/server'

/** Troca a empresa ativa da sessão (só entre empresas onde a pessoa tem vínculo). */
export async function trocarEmpresa(formData: FormData) {
  const id = String(formData.get('empresa_id') || '')

  const supabase = await createClient()
  const { data } = await supabase.rpc('minhas_empresas')
  const permitido = ((data ?? []) as { id: string }[]).some((e) => e.id === id)

  if (permitido) {
    const cookieStore = await cookies()
    cookieStore.set(EMPRESA_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  redirect('/dashboard')
}
