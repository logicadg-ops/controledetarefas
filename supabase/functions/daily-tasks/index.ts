// ============================================================================
// Edge Function: daily-tasks
// Roda 1x por dia (agendar via Supabase Scheduled Functions / pg_cron).
// 1) Na virada do dia/semana/mês, recria as tarefas das recorrências ativas
//    (função SQL gerar_tarefas_recorrentes; no cadastro a interface já gera
//    a primeira). É idempotente: rodar mais de uma vez não duplica.
// 2) Se notificar_whatsapp estiver ligado, para cada empresa:
//    a) manda uma mensagem no WhatsApp de cada responsável (usuarios.whatsapp),
//       via Z-API (ou serviço equivalente), com as tarefas atrasadas e as que
//       vencem dentro de "antecedencia_horas"+"antecedencia_minutos" — tarefas de setor inteiro
//       avisam todo mundo ativo do setor;
//    b) se "webhook_url" estiver preenchido, também posta o payload bruto lá
//       (uso opcional, ex.: fluxo próprio no n8n/Make).
//
// Deploy:  supabase functions deploy daily-tasks
// Agendar: supabase functions schedule daily-tasks --cron "0 9 * * *"
//          (ou crie o cron job direto em Database > Cron Jobs, chamando a
//          function via pg_net.http_post — ver README.md)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// URL pública do app, só para o link no fim da mensagem (opcional).
const SITE_URL = Deno.env.get('SITE_URL') ?? ''

// ----------------------------------------------------------------------------
// WhatsApp (Z-API ou equivalente) — mantenha em sincronia com src/lib/whatsapp.ts
// ----------------------------------------------------------------------------
function normalizarTelefoneBr(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.length < 10) return null
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

// Aceita tanto a URL base da instância quanto a URL já com "/send-text" no
// final (muitos painéis de provedor mostram essa como exemplo, e é comum
// colarem ela inteira) — sem isso, ficaria ".../send-text/send-text".
function montarUrlSendText(bruta: string): string {
  const semBarraFinal = bruta.trim().replace(/\/+$/, '')
  return /\/send-text$/i.test(semBarraFinal) ? semBarraFinal : `${semBarraFinal}/send-text`
}

async function enviarWhatsApp(
  instanceUrlBruta: string,
  clientToken: string | null,
  telefoneBruto: string,
  mensagem: string
): Promise<void> {
  const instanceUrl = montarUrlSendText(instanceUrlBruta)
  const telefone = normalizarTelefoneBr(telefoneBruto)
  if (!telefone) throw new Error(`telefone inválido "${telefoneBruto}"`)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken

  const resp = await fetch(instanceUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: telefone, message: mensagem }),
  })
  const corpo = await resp.text().catch(() => '')
  if (!resp.ok) {
    throw new Error(`provedor respondeu ${resp.status}: ${corpo.slice(0, 200)}`)
  }

  // Alguns gateways devolvem HTTP 200 mesmo em erro (ex.: instância
  // desconectada) — o problema aparece só dentro do corpo da resposta.
  try {
    const json = JSON.parse(corpo)
    const possivelErro = json?.error ?? json?.message ?? (json?.value === false ? json : null)
    if (possivelErro) {
      throw new Error(`provedor aceitou mas indicou erro: ${JSON.stringify(possivelErro).slice(0, 200)}`)
    }
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

const formatarDataHoraBrt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

interface UsuarioResumo {
  id: string
  nome: string
  whatsapp: string | null
  setor_id: string
}

interface TarefaAviso {
  id: string
  titulo: string
  prazo: string
  setor_id: string
  cliente_id: string | null
  responsavel_tipo: 'usuario' | 'setor'
  responsavel_id: string | null
}

// Ex.: 90 -> "1h30", 120 -> "2h", 30 -> "30min".
function formatarAntecedencia(minutosTotais: number): string {
  const h = Math.floor(minutosTotais / 60)
  const m = minutosTotais % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function montarMensagem(
  nome: string,
  atrasadas: TarefaAviso[],
  vencemHoje: TarefaAviso[],
  antecedenciaMinutos: number,
  clientePorId: Map<string, string>
) {
  const primeiroNome = nome.split(' ')[0]
  const linhas: string[] = [`Olá, ${primeiroNome}! 👋 Resumo das suas tarefas no Painel de Tarefas:`]

  const linhaTarefa = (t: TarefaAviso) => {
    const cliente = t.cliente_id ? clientePorId.get(t.cliente_id) : null
    return `• ${t.titulo}${cliente ? ` (cliente: ${cliente})` : ''}\n  prazo ${formatarDataHoraBrt(t.prazo)}`
  }

  const listar = (tarefas: TarefaAviso[]) => {
    const linhasDaLista = tarefas.slice(0, 10).map(linhaTarefa)
    if (tarefas.length > 10) linhasDaLista.push(`• …e mais ${tarefas.length - 10}.`)
    return linhasDaLista.join('\n\n')
  }

  if (atrasadas.length > 0) {
    linhas.push('', `⚠️ Atrasadas (${atrasadas.length}):`, listar(atrasadas))
  }
  if (vencemHoje.length > 0) {
    linhas.push(
      '',
      `⏰ Vencem nas próximas ${formatarAntecedencia(antecedenciaMinutos)} (${vencemHoje.length}):`,
      listar(vencemHoje)
    )
  }
  if (SITE_URL) linhas.push('', `Acesse: ${SITE_URL}/tarefas`)

  return linhas.join('\n')
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const agora = new Date()

  // ------------------------------------------------------------------------
  // 1) Gerar tarefas do período atual a partir das recorrências ativas
  // ------------------------------------------------------------------------
  const { data: geradas, error: geracaoError } = await supabase.rpc('gerar_tarefas_recorrentes')

  if (geracaoError) {
    return new Response(JSON.stringify({ error: geracaoError.message }), { status: 500 })
  }

  // ------------------------------------------------------------------------
  // 2) Notificações — uma vez por empresa, cada uma com a própria config e
  //    só com as próprias tarefas.
  // ------------------------------------------------------------------------
  const { data: empresas } = await supabase.from('empresas').select('id, nome').eq('ativa', true)
  const { data: configs } = await supabase.from('config_geral').select('*')

  let empresasComAviso = 0
  let mensagensEnviadas = 0
  let mensagensComFalha = 0

  for (const empresa of empresas ?? []) {
    const config = (configs ?? []).find((c) => c.empresa_id === empresa.id)
    if (!config?.notificar_whatsapp) continue

    const antecedenciaMinutos = (config.antecedencia_horas ?? 24) * 60 + (config.antecedencia_minutos ?? 0)
    const limite = new Date(agora.getTime() + antecedenciaMinutos * 60 * 1000)

    const { data: tarefas } = await supabase
      .from('tarefas')
      .select('id, titulo, prazo, setor_id, cliente_id, responsavel_tipo, responsavel_id, status')
      .eq('empresa_id', empresa.id)
      .in('status', ['pendente', 'andamento'])
      .lte('prazo', limite.toISOString())

    const atrasadas = ((tarefas ?? []) as TarefaAviso[]).filter((t) => new Date(t.prazo).getTime() < agora.getTime())
    const vencemHoje = ((tarefas ?? []) as TarefaAviso[]).filter((t) => new Date(t.prazo).getTime() >= agora.getTime())

    if (atrasadas.length === 0 && vencemHoje.length === 0) continue
    empresasComAviso++

    // 2a) Webhook bruto, opcional (comportamento de sempre, inalterado).
    if (config.webhook_url) {
      try {
        await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa: { id: empresa.id, nome: empresa.nome }, atrasadas, vencemHoje, geradoEm: agora.toISOString() }),
        })
      } catch (e) {
        console.error(`Falha ao chamar webhook da empresa ${empresa.nome}:`, e)
      }
    }

    // 2b) WhatsApp direto para cada responsável.
    if (!config.zapi_instance_url) continue

    const { data: usuariosData } = await supabase
      .from('usuarios')
      .select('id, nome, whatsapp, setor_id')
      .eq('empresa_id', empresa.id)
      .eq('ativo', true)
    const usuarios: UsuarioResumo[] = usuariosData ?? []

    const { data: clientesData } = await supabase.from('clientes').select('id, nome').eq('empresa_id', empresa.id)
    const clientePorId = new Map((clientesData ?? []).map((c) => [c.id, c.nome] as const))

    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]))
    const usuariosPorSetor = new Map<string, UsuarioResumo[]>()
    for (const u of usuarios) {
      const lista = usuariosPorSetor.get(u.setor_id) ?? []
      lista.push(u)
      usuariosPorSetor.set(u.setor_id, lista)
    }

    // Agrupa as tarefas de cada pessoa (tarefa de setor avisa todo mundo ativo do setor).
    const tarefasPorUsuario = new Map<string, { atrasadas: TarefaAviso[]; vencemHoje: TarefaAviso[] }>()
    const adicionar = (usuarioId: string, tarefa: TarefaAviso, atrasada: boolean) => {
      const grupo = tarefasPorUsuario.get(usuarioId) ?? { atrasadas: [], vencemHoje: [] }
      ;(atrasada ? grupo.atrasadas : grupo.vencemHoje).push(tarefa)
      tarefasPorUsuario.set(usuarioId, grupo)
    }
    for (const t of [...atrasadas.map((t) => [t, true] as const), ...vencemHoje.map((t) => [t, false] as const)]) {
      const [tarefa, atrasada] = t
      if (tarefa.responsavel_tipo === 'usuario' && tarefa.responsavel_id) {
        adicionar(tarefa.responsavel_id, tarefa, atrasada)
      } else if (tarefa.responsavel_tipo === 'setor') {
        for (const u of usuariosPorSetor.get(tarefa.setor_id) ?? []) adicionar(u.id, tarefa, atrasada)
      }
    }

    for (const [usuarioId, grupo] of tarefasPorUsuario) {
      const usuario = usuarioPorId.get(usuarioId)
      if (!usuario?.whatsapp) continue

      const mensagem = montarMensagem(usuario.nome, grupo.atrasadas, grupo.vencemHoje, antecedenciaMinutos, clientePorId)
      try {
        await enviarWhatsApp(config.zapi_instance_url, config.zapi_client_token, usuario.whatsapp, mensagem)
        mensagensEnviadas++
      } catch (e) {
        mensagensComFalha++
        console.error(`Falha ao enviar WhatsApp para ${usuario.nome} (${empresa.nome}):`, e)
      }
      // Espaça os envios para não soar como disparo em massa ao provedor.
      await espera(1500)
    }
  }

  return new Response(
    JSON.stringify({ geradas, empresasComAviso, mensagensEnviadas, mensagensComFalha }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
