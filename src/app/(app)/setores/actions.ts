'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
}

export async function criarSetor(formData: FormData) {
  await assertAdmin()
  const nome = String(formData.get('nome') || '').trim()
  if (!nome) return

  const supabase = await createClient()
  await supabase.from('setores').insert({ nome })
  revalidatePath('/setores')
}

export async function alternarSetor(id: string, ativo: boolean) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('setores').update({ ativo: !ativo }).eq('id', id)
  revalidatePath('/setores')
}
