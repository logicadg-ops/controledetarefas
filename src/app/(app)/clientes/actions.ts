'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
}

export async function criarCliente(formData: FormData) {
  await assertAdmin()
  const nome = String(formData.get('nome') || '').trim()
  if (!nome) return

  const supabase = await createClient()
  await supabase.from('clientes').insert({ nome })
  revalidatePath('/clientes')
}

export async function alternarCliente(id: string, ativo: boolean) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('clientes').update({ ativo: !ativo }).eq('id', id)
  revalidatePath('/clientes')
}

export async function atualizarCliente(id: string, formData: FormData) {
  await assertAdmin()
  const nome = String(formData.get('nome') || '').trim()
  if (!nome) return

  const supabase = await createClient()
  await supabase.from('clientes').update({ nome }).eq('id', id)
  revalidatePath('/clientes')
  revalidatePath('/tarefas')
}

// As tarefas do cliente permanecem, mas perdem o vínculo (ON DELETE SET NULL).
export async function excluirCliente(id: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('clientes').delete().eq('id', id)
  revalidatePath('/clientes')
  revalidatePath('/tarefas')
}
