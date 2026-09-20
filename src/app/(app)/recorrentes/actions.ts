'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Frequencia, Prioridade, ResponsavelTipo } from '@/lib/types'

async function assertAdmin() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
}

// Lê e valida o formulário; em caso de erro volta para `voltarPara` com a mensagem.
function lerFormulario(formData: FormData, voltarPara: string) {
  const titulo = String(formData.get('titulo') || '').trim()
  const descricao = String(formData.get('descricao') || '').trim()
  const setorId = String(formData.get('setor_id') || '')
  const clienteId = String(formData.get('cliente_id') || '') || null
  const responsavelTipo = String(formData.get('responsavel_tipo') || 'usuario') as ResponsavelTipo
  const responsavelId = String(formData.get('responsavel_id') || '') || null
  const frequencia = String(formData.get('frequencia') || 'diaria') as Frequencia
  const diasSemana = formData.getAll('dias_semana').map((d) => Number(d))
  const diaMes = formData.get('dia_mes') ? Number(formData.get('dia_mes')) : null
  const prazoHora = String(formData.get('prazo_hora') || '18:00')
  const metaHora = String(formData.get('meta_hora') || '') || null
  const prioridade = String(formData.get('prioridade') || 'media') as Prioridade

  if (!titulo || !setorId) {
    redirect(`${voltarPara}?erro=Preencha+t%C3%ADtulo+e+setor.`)
  }

  if (metaHora && metaHora > prazoHora) {
    redirect(`${voltarPara}?erro=A+hora+da+meta+precisa+ser+igual+ou+anterior+%C3%A0+do+prazo.`)
  }

  return {
    titulo,
    descricao,
    setor_id: setorId,
    cliente_id: clienteId,
    responsavel_tipo: responsavelTipo,
    responsavel_id: responsavelTipo === 'usuario' ? responsavelId : null,
    frequencia,
    dias_semana: frequencia === 'semanal' ? diasSemana : [],
    dia_mes: frequencia === 'mensal' ? diaMes : null,
    prazo_hora: prazoHora,
    meta_hora: metaHora,
    prioridade,
  }
}

export async function criarRecorrente(formData: FormData) {
  await assertAdmin()

  const dados = lerFormulario(formData, '/recorrentes')

  // Uma recorrência por cliente selecionado; sem seleção, uma sem cliente.
  const clienteIds = formData.getAll('cliente_ids').map(String).filter(Boolean)
  const linhas = (clienteIds.length > 0 ? clienteIds : [null]).map((clienteId) => ({
    ...dados,
    cliente_id: clienteId,
  }))

  const supabase = await createClient()
  const { data: criadas, error } = await supabase.from('recorrentes').insert(linhas).select('id')

  if (error) {
    redirect(`/recorrentes?erro=${encodeURIComponent(error.message)}`)
  }

  // Cria já a tarefa do período atual; a rotina diária recria nas viradas.
  for (const criada of criadas ?? []) {
    const { error: geracaoError } = await supabase.rpc('gerar_tarefas_recorrentes', {
      p_recorrente_id: criada.id,
    })
    if (geracaoError) {
      redirect(`/recorrentes?erro=${encodeURIComponent(geracaoError.message)}`)
    }
  }

  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
}

// A edição vale para as próximas tarefas e para as já criadas que ainda não foram iniciadas.
export async function atualizarRecorrente(id: string, formData: FormData) {
  await assertAdmin()

  const dados = lerFormulario(formData, `/recorrentes/${id}`)

  const supabase = await createClient()
  const { error } = await supabase.from('recorrentes').update(dados).eq('id', id)

  if (error) {
    redirect(`/recorrentes/${id}?erro=${encodeURIComponent(error.message)}`)
  }

  const { error: syncError } = await supabase.rpc('sincronizar_tarefas_recorrente', {
    p_recorrente_id: id,
  })
  if (syncError) {
    redirect(`/recorrentes/${id}?erro=${encodeURIComponent(syncError.message)}`)
  }

  // Se a frequência mudou e o novo período ainda não tem tarefa, cria agora.
  await supabase.rpc('gerar_tarefas_recorrentes', { p_recorrente_id: id })

  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
  redirect('/recorrentes')
}

// As tarefas já geradas permanecem (recorrente_id vira null pelo ON DELETE SET NULL).
export async function excluirRecorrente(id: string) {
  await assertAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('recorrentes').delete().eq('id', id)

  if (error) {
    redirect(`/recorrentes?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/recorrentes')
}

export async function alternarRecorrente(id: string, ativo: boolean) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('recorrentes').update({ ativo: !ativo }).eq('id', id)
  // Ao reativar, garante a tarefa do período atual (não duplica se já existir).
  if (!ativo) await supabase.rpc('gerar_tarefas_recorrentes', { p_recorrente_id: id })
  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
}
