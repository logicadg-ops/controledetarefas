'use server'

import { cookies } from 'next/headers'
import { createClient, EMPRESA_COOKIE } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(EMPRESA_COOKIE)
  redirect('/login')
}

export async function recuperarSenha(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/atualizar-senha`,
  })
  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`)
  }
  redirect('/login?aviso=Se+o+e-mail+existir%2C+enviamos+um+link+de+recupera%C3%A7%C3%A3o.')
}
