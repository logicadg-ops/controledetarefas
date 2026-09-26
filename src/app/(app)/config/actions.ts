'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { enviarWhatsApp } from '@/lib/whatsapp'

export async function salvarConfig(formData: FormData) {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')

  const webhookUrl = String(formData.get('webhook_url') || '').trim()
  const antecedenciaHoras = Math.max(0, Number(formData.get('antecedencia_horas') || 0))
  const antecedenciaMinutos = Math.min(59, Math.max(0, Number(formData.get('antecedencia_minutos') || 0)))
  const notificarWhatsapp = formData.get('notificar_whatsapp') === 'on'
  const zapiInstanceUrl = String(formData.get('zapi_instance_url') || '').trim() || null
  const zapiClientToken = String(formData.get('zapi_client_token') || '').trim() || null

  if (antecedenciaHoras === 0 && antecedenciaMinutos === 0) {
    redirect('/config?erro=A+antecedência+precisa+ser+maior+que+zero.')
  }

  const supabase = await createClient()
  await supabase
    .from('config_geral')
    .update({
      webhook_url: webhookUrl,
      antecedencia_horas: antecedenciaHoras,
      antecedencia_minutos: antecedenciaMinutos,
      notificar_whatsapp: notificarWhatsapp,
      zapi_instance_url: zapiInstanceUrl,
      zapi_client_token: zapiClientToken,
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', usuario.empresa_id)

  revalidatePath('/config')
}

// Manda uma mensagem de teste para o telefone informado, usando a config já
// salva — serve para validar a URL da instância e o token sem esperar a
// rotina diária. Não altera nada no banco.
export async function testarWhatsapp(formData: FormData) {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')

  const telefone = String(formData.get('telefone_teste') || '').trim()
  if (!telefone) {
    redirect('/config?erro=Informe+um+telefone+para+o+teste.')
  }

  const supabase = await createClient()
  const { data: config } = await supabase
    .from('config_geral')
    .select('zapi_instance_url, zapi_client_token')
    .eq('empresa_id', usuario.empresa_id)
    .single()

  if (!config?.zapi_instance_url) {
    redirect('/config?erro=Preencha+e+salve+a+URL+da+inst%C3%A2ncia+antes+de+testar.')
  }

  let respostaProvedor = ''
  try {
    respostaProvedor = await enviarWhatsApp(
      config,
      telefone,
      `Teste do Painel de Tarefas (${usuario.empresa_nome}): se você recebeu esta mensagem, a notificação por WhatsApp está funcionando. ✅`
    )
  } catch (e) {
    redirect(`/config?erro=${encodeURIComponent(`Falha ao enviar: ${e instanceof Error ? e.message : String(e)}`)}`)
  }

  redirect(
    `/config?aviso=${encodeURIComponent(
      `Provedor aceitou o envio para ${telefone}. Resposta: ${respostaProvedor || '(vazia)'} — se mesmo assim não chegar no WhatsApp, confira se a instância está conectada no painel do provedor.`
    )}`
  )
}
