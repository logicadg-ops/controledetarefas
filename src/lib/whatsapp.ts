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

/**
 * Monta a URL de envio a partir do que foi salvo — aceita tanto a URL base
 * da instância (ex.: .../token/XXXX) quanto a URL completa já com
 * "/send-text" no final (é o que muitos painéis de provedor mostram como
 * exemplo, e é comum colarem ela inteira). Sem isso, colar a URL completa
 * faz o sistema chamar ".../send-text/send-text", que não existe.
 */
function montarUrlSendText(bruta: string | null): string | null {
  const semBarraFinal = (bruta || '').trim().replace(/\/+$/, '')
  if (!semBarraFinal) return null
  return /\/send-text$/i.test(semBarraFinal) ? semBarraFinal : `${semBarraFinal}/send-text`
}

/**
 * Envia uma mensagem de texto. Lança erro com uma mensagem legível em caso de
 * falha — inclusive quando o provedor responde HTTP 200 mas com um corpo que
 * indica erro (comum em gateways não-oficiais, ex.: instância desconectada).
 * Em caso de sucesso, devolve a resposta bruta do provedor (para conferência).
 */
export async function enviarWhatsApp(config: ConfigZapi, telefoneBruto: string, mensagem: string): Promise<string> {
  const instanceUrl = montarUrlSendText(config.zapi_instance_url)
  if (!instanceUrl) throw new Error('URL da instância não configurada.')

  const telefone = normalizarTelefoneBr(telefoneBruto)
  if (!telefone) throw new Error(`Telefone inválido: "${telefoneBruto}".`)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.zapi_client_token) headers['Client-Token'] = config.zapi_client_token

  const resp = await fetch(instanceUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: telefone, message: mensagem }),
  })

  const corpo = await resp.text().catch(() => '')

  if (!resp.ok) {
    throw new Error(`Provedor respondeu ${resp.status}: ${corpo.slice(0, 300) || resp.statusText}`)
  }

  // Alguns gateways devolvem HTTP 200 mesmo em erro (ex.: instância
  // desconectada) — o problema aparece só dentro do corpo da resposta.
  try {
    const json = JSON.parse(corpo)
    const possivelErro = json?.error ?? json?.message ?? (json?.value === false ? json : null)
    if (possivelErro) {
      throw new Error(`Provedor aceitou a requisição, mas indicou erro: ${JSON.stringify(possivelErro).slice(0, 300)}`)
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // corpo não é JSON — segue como sucesso, mas devolve o texto bruto.
    } else {
      throw e
    }
  }

  return corpo.slice(0, 500)
}

export interface TarefaParaAviso {
  titulo: string
  prazo: string
  clienteNome: string | null
}

/**
 * Monta a mensagem do disparo manual (aviso avulso sobre tarefas escolhidas
 * pelo admin, diferente do resumo diário automático). Mesmo estilo visual do
 * resumo diário: uma linha em branco entre tarefas, cliente entre parênteses
 * quando houver, e "atrasada" quando o prazo já passou.
 */
export function montarMensagemManual(nome: string, tarefas: TarefaParaAviso[], siteUrl: string): string {
  const primeiroNome = nome.split(' ')[0]
  const agora = Date.now()
  const formatarDataHoraBrt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

  const linhas: string[] = [
    `Olá, ${primeiroNome}! 👋 Aviso sobre ${tarefas.length === 1 ? 'uma tarefa sua' : `${tarefas.length} tarefas suas`} no Painel de Tarefas:`,
    '',
    tarefas
      .map((t) => {
        const atrasada = new Date(t.prazo).getTime() < agora
        return `• ${t.titulo}${t.clienteNome ? ` (cliente: ${t.clienteNome})` : ''}\n  prazo ${formatarDataHoraBrt(t.prazo)}${atrasada ? ' ⚠️ atrasada' : ''}`
      })
      .join('\n\n'),
  ]
  if (siteUrl) linhas.push('', `Acesse: ${siteUrl}/tarefas`)

  return linhas.join('\n')
}
