'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function definirSenha(formData: FormData) {
  const password = String(formData.get('password') || '')
  const confirmacao = String(formData.get('confirmacao') || '')

  if (password.length < 8) {
    redirect('/auth/atualizar-senha?erro=A+senha+precisa+ter+ao+menos+8+caracteres.')
  }
  if (password !== confirmacao) {
    redirect('/auth/atualizar-senha?erro=As+senhas+n%C3%A3o+coincidem.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    redirect(`/auth/atualizar-senha?erro=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}
