'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { buscarAuthUserIdPorEmail } from '@/lib/auth-admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Role } from '@/lib/types'

async function assertAdmin() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
}

export async function criarUsuario(formData: FormData) {
  await assertAdmin()

  const nome = String(formData.get('nome') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const cargo = String(formData.get('cargo') || '').trim()
  const whatsapp = String(formData.get('whatsapp') || '').trim() || null
  const setorId = String(formData.get('setor_id') || '') || null
  const role = (String(formData.get('role') || 'comum')) as Role

  if (!nome || !email) {
    redirect('/usuarios?erro=Preencha+nome+e+e-mail.')
  }

  const supabase = await createClient()
  const { data: criado, error } = await supabase
    .from('usuarios')
    .insert({
      nome,
      email,
      cargo,
      whatsapp,
      setor_id: setorId,
      role,
    })
    .select('id')
    .single()

  if (error) {
    redirect(`/usuarios?erro=${encodeURIComponent(error.message)}`)
  }

  // Se a pessoa já tem login (por outra empresa), o vínculo novo usa o mesmo acesso.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const authUserId = await buscarAuthUserIdPorEmail(email)
    if (authUserId) {
      await createAdminClient().from('usuarios').update({ auth_user_id: authUserId }).eq('id', criado.id)
    }
  }

  revalidatePath('/usuarios')
}

// Não inclui e-mail: é a chave usada para ligar o convite/login (auth_user_id)
// ao cadastro — trocá-lo depois de criado quebraria esse vínculo.
export async function atualizarUsuario(id: string, formData: FormData) {
  await assertAdmin()

  const nome = String(formData.get('nome') || '').trim()
  const cargo = String(formData.get('cargo') || '').trim()
  const whatsapp = String(formData.get('whatsapp') || '').trim() || null
  const setorId = String(formData.get('setor_id') || '') || null
  const role = (String(formData.get('role') || 'comum')) as Role

  if (!nome) {
    redirect('/usuarios?erro=Preencha+o+nome.')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('usuarios')
    .update({ nome, cargo, whatsapp, setor_id: setorId, role })
    .eq('id', id)

  if (error) {
    redirect(`/usuarios?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/usuarios')
}

export async function alternarUsuario(id: string, ativo: boolean) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('usuarios').update({ ativo: !ativo }).eq('id', id)
  revalidatePath('/usuarios')
}

/**
 * Envia o convite do Supabase Auth para o e-mail cadastrado. Quando a
 * pessoa aceitar, a trigger link_usuario_on_signup() vincula
 * automaticamente auth_user_id a este registro (mesmo e-mail).
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY configurada (ver .env.example).
 */
export async function convidarUsuario(email: string) {
  await assertAdmin()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect(
      '/usuarios?erro=Configure+SUPABASE_SERVICE_ROLE_KEY+no+.env.local+para+enviar+convites.'
    )
  }

  // Pessoa que já tem login (por outra empresa) não recebe convite: basta vincular.
  const authUserId = await buscarAuthUserIdPorEmail(email)
  if (authUserId) {
    const atual = await getUsuarioLogado()
    await createAdminClient()
      .from('usuarios')
      .update({ auth_user_id: authUserId })
      .eq('email', email)
      .eq('empresa_id', atual!.empresa_id)
    redirect('/usuarios?aviso=' + encodeURIComponent(email + ' já tem acesso ao sistema e agora também acessa esta empresa.'))
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/atualizar-senha`,
  })

  if (error) {
    redirect(`/usuarios?erro=${encodeURIComponent(error.message)}`)
  }

  redirect('/usuarios?aviso=Convite+enviado+para+' + encodeURIComponent(email))
}
