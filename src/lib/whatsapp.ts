// Envio de WhatsApp via Z-API (ou serviço equivalente com o mesmo contrato:
// POST { phone, message } na URL da instância, com "Client-Token" opcional).
//
// Usado tanto pelo botão "Enviar teste" (Configurações) quanto, em versão
// própria (Deno, sem poder importar este arquivo), pela Edge Function
// daily-tasks — mantenha as duas em sincronia se mudar a regra aqui.

/**
 * Normaliza um telefone brasileiro para o formato que a Z-API espera
 * (DDI + DDD + número, só dígitos, ex.: 5581999999999). Retorna null se o
 * texto não tiver dígitos suficientes para ser um telefone.
 */
export function normalizarTelefoneBr(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.length < 10) return null
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

export interface ConfigZapi {
  zapi_instance_url: string | null
  zapi_client_token: string | null
}

/** Envia uma mensagem de texto. Lança erro com uma mensagem legível em caso de falha. */
export async function enviarWhatsApp(config: ConfigZapi, telefoneBruto: string, mensagem: string): Promise<void> {
  const instanceUrl = (config.zapi_instance_url || '').trim().replace(/\/+$/, '')
  if (!instanceUrl) throw new Error('URL da instância não configurada.')

  const telefone = normalizarTelefoneBr(telefoneBruto)
  if (!telefone) throw new Error(`Telefone inválido: "${telefoneBruto}".`)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.zapi_client_token) headers['Client-Token'] = config.zapi_client_token

  const resp = await fetch(`${instanceUrl}/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: telefone, message: mensagem }),
  })

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '')
    throw new Error(`Provedor respondeu ${resp.status}: ${corpo.slice(0, 300) || resp.statusText}`)
  }
}
