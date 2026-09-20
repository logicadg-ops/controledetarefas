'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { buscarAuthUserIdPorEmail } from '@/lib/auth-admin'

async function assertDono() {
  const usuario = await getUsuarioLogado()
  if (!usuario?.plataforma_admin) throw new Error('Apenas o dono da plataforma pode gerir empresas.')
  return usuario
}

function formatarCnpj(bruto: string): string | null {
  const d = bruto.replace(/\D/g, '')
  if (d.length === 0) return null
  if (d.length !== 14) return 'invalido'
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export async function criarEmpresa(formData: FormData) {
  const dono = await assertDono()

  const nome = String(formData.get('nome') || '').trim()
  const proprietario = String(formData.get('proprietario') || '').trim()
  const emailAdmin = String(formData.get('email_admin') || '').trim().toLowerCase()
  const cnpj = formatarCnpj(String(formData.get('cnpj') || ''))

  if (!nome) redirect('/empresas?erro=Informe+o+nome+da+empresa.')
  if (cnpj === 'invalido') redirect('/empresas?erro=CNPJ+inv%C3%A1lido+(s%C3%A3o+14+d%C3%ADgitos).')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect('/empresas?erro=Configure+SUPABASE_SERVICE_ROLE_KEY+no+.env.local.')
  }

  // Service role: o dono ainda não é membro da empresa nova, então as policies
  // (empresa ativa) não deixariam criar os vínculos iniciais.
  const admin = createAdminClient()

  const { data: empresa, error } = await admin
    .from('empresas')
    .insert({ nome, cnpj, proprietario: proprietario || null, email_admin: emailAdmin || null })
    .select('id')
    .single()

  if (error) {
    const msg = error.message.includes('empresas_cnpj_unico') ? 'Já existe uma empresa com este CNPJ.' : error.message
    redirect(`/empresas?erro=${encodeURIComponent(msg)}`)
  }

  const vinculos: Record<string, unknown>[] = [
    // O dono entra como administrador da empresa nova, para poder trocar para ela.
    {
      empresa_id: empresa.id,
      auth_user_id: dono.auth_user_id,
      nome: dono.nome,
      email: dono.email,
      role: 'admin',
    },
  ]

  let avisoConvite = ''
  if (emailAdmin && emailAdmin !== dono.email?.toLowerCase()) {
    const authUserId = await buscarAuthUserIdPorEmail(emailAdmin)
    vinculos.push({
      empresa_id: empresa.id,
      auth_user_id: authUserId,
      nome: proprietario || emailAdmin.split('@')[0],
      email: emailAdmin,
      role: 'admin',
    })
    if (!authUserId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const { error: conviteError } = await admin.auth.admin.inviteUserByEmail(emailAdmin, {
        redirectTo: `${siteUrl}/auth/confirm?next=/auth/atualizar-senha`,
      })
      avisoConvite = conviteError
        ? ` Não foi possível enviar o convite (${conviteError.message}); convide pela aba Usuários.`
        : ` Convite enviado para ${emailAdmin}.`
    }
  }

  const { error: vinculoError } = await admin.from('usuarios').insert(vinculos)
  if (vinculoError) {
    // Desfaz: não deixa uma empresa sem administrador.
    await admin.from('empresas').delete().eq('id', empresa.id)
    redirect(`/empresas?erro=${encodeURIComponent(vinculoError.message)}`)
  }

  revalidatePath('/empresas')
  redirect('/empresas?aviso=' + encodeURIComponent(`Empresa "${nome}" criada.${avisoConvite}`))
}

export async function alternarEmpresa(id: string, ativa: boolean) {
  const dono = await assertDono()
  if (ativa && id === dono.empresa_id) {
    redirect('/empresas?erro=Troque+para+outra+empresa+antes+de+desativar+esta.')
  }
  const supabase = await createClient()
  await supabase.from('empresas').update({ ativa: !ativa }).eq('id', id)
  revalidatePath('/empresas')
}
