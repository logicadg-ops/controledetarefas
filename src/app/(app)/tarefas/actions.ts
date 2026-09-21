'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ResponsavelTipo, StatusTarefa } from '@/lib/types'

export async function criarTarefa(formData: FormData) {
  const supabase = await createClient()
  const usuario = await getUsuarioLogado()
  if (!usuario) throw new Error('Usuário não identificado')

  const titulo = String(formData.get('titulo') || '').trim()
  const descricao = String(formData.get('descricao') || '').trim()
  const prioridade = String(formData.get('prioridade') || 'media')
  const prazoData = String(formData.get('prazo_data') || '')
  const prazoHora = String(formData.get('prazo_hora') || '18:00')
  const metaData = String(formData.get('meta_data') || '')
  const metaHora = String(formData.get('meta_hora') || '16:00')
  const clienteId = String(formData.get('cliente_id') || '') || null

  // Usuário comum só pode criar tarefa para si mesmo, no próprio setor —
  // a RLS (tarefas_insert) também garante isso no banco; aqui é só UX.
  const responsavelTipo: ResponsavelTipo =
    usuario.role === 'admin' ? (String(formData.get('responsavel_tipo')) as ResponsavelTipo) : 'usuario'
  const responsavelId =
    usuario.role === 'admin' ? String(formData.get('responsavel_id') || '') || null : usuario.id
  const setorId = usuario.role === 'admin' ? String(formData.get('setor_id') || '') : usuario.setor_id

  if (!titulo || !prazoData || !metaData || !setorId) {
    redirect('/tarefas/nova?erro=Preencha+t%C3%ADtulo%2C+setor%2C+prazo+e+meta.')
  }

  const prazo = new Date(`${prazoData}T${prazoHora}:00`)
  const meta = new Date(`${metaData}T${metaHora}:00`)

  if (meta.getTime() > prazo.getTime()) {
    redirect('/tarefas/nova?erro=A+meta+precisa+ser+igual+ou+anterior+ao+prazo.')
  }

  const { error } = await supabase.from('tarefas').insert({
    titulo,
    descricao,
    tipo: 'avulsa',
    cliente_id: clienteId,
    setor_id: setorId,
    responsavel_tipo: responsavelTipo,
    responsavel_id: responsavelTipo === 'usuario' ? responsavelId : null,
    prioridade,
    prazo: prazo.toISOString(),
    meta: meta.toISOString(),
    criado_por: usuario.id,
  })

  if (error) {
    redirect(`/tarefas/nova?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/tarefas')
  revalidatePath('/dashboard')
  redirect('/tarefas')
}

export async function atualizarStatus(id: string, status: StatusTarefa) {
  'use server'
  const supabase = await createClient()
  const usuario = await getUsuarioLogado()
  // Sessão expirada/inválida: volta ao login em vez de estourar um erro na tela.
  if (!usuario) redirect('/login?erro=Sua+sess%C3%A3o+expirou.+Entre+novamente.')

  const patch: Record<string, unknown> = { status }

  if (status === 'andamento') {
    const { data: tarefa } = await supabase.from('tarefas').select('data_inicio').eq('id', id).single()
    if (!tarefa?.data_inicio) {
      patch.data_inicio = new Date().toISOString()
    }
  }

  if (status === 'concluida') {
    const { data: tarefa } = await supabase.from('tarefas').select('prazo, meta').eq('id', id).single()
    const agora = new Date().getTime()
    patch.data_conclusao = new Date().toISOString()
    patch.concluido_por = usuario.id
    patch.no_prazo = tarefa ? agora <= new Date(tarefa.prazo).getTime() : null
    patch.no_meta = tarefa?.meta ? agora <= new Date(tarefa.meta).getTime() : null
  } else {
    patch.data_conclusao = null
    patch.concluido_por = null
    patch.no_prazo = null
    patch.no_meta = null
  }

  // Reabrir (voltar para pendente) reseta o fluxo de execução para uma nova medição.
  if (status === 'pendente') {
    patch.data_inicio = null
  }

  await supabase.from('tarefas').update(patch).eq('id', id)

  revalidatePath('/tarefas')
  revalidatePath('/dashboard')
}

// Exclusão só para administradores e só de tarefas ainda não concluídas.
// A regra é aplicada no banco (excluir_tarefa); tarefas de recorrência ficam
// registradas como "puladas" para a rotina diária não recriá-las no período.
export async function excluirTarefa(id: string) {
  'use server'
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem excluir tarefas.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('excluir_tarefa', { p_id: id })
  if (error) throw new Error(error.message)

  revalidatePath('/tarefas')
  revalidatePath('/dashboard')
}
