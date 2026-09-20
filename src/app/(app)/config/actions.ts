'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'

export async function salvarConfig(formData: FormData) {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')

  const webhookUrl = String(formData.get('webhook_url') || '').trim()
  const antecedenciaHoras = Number(formData.get('antecedencia_horas') || 24)
  const notificarWhatsapp = formData.get('notificar_whatsapp') === 'on'

  const supabase = await createClient()
  await supabase
    .from('config_geral')
    .update({
      webhook_url: webhookUrl,
      antecedencia_horas: antecedenciaHoras,
      notificar_whatsapp: notificarWhatsapp,
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', usuario.empresa_id)

  revalidatePath('/config')
}
