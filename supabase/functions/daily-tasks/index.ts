// ============================================================================
// Edge Function: daily-tasks
// Roda 1x por dia (agendar via Supabase Scheduled Functions / pg_cron).
// 1) Na virada do dia/semana/mês, recria as tarefas das recorrências ativas
//    (função SQL gerar_tarefas_recorrentes; no cadastro a interface já gera
//    a primeira). É idempotente: rodar mais de uma vez não duplica.
// 2) Se notificar_whatsapp estiver ligado, envia um POST para webhook_url
//    com as tarefas atrasadas e as que vencem dentro de "antecedencia_horas".
//
// Deploy:  supabase functions deploy daily-tasks
// Agendar: supabase functions schedule daily-tasks --cron "0 9 * * *"
//          (ou crie o cron job direto em Database > Cron Jobs, chamando a
//          function via pg_net.http_post — ver README.md)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
  // 2) Notificações (atrasadas + que vencem hoje) via webhook — uma vez por
  //    empresa, cada uma com a sua configuração e só com as suas tarefas.
  // ------------------------------------------------------------------------
  const { data: empresas } = await supabase.from('empresas').select('id, nome').eq('ativa', true)
  const { data: configs } = await supabase.from('config_geral').select('*')

  let notificadas = 0
  for (const empresa of empresas ?? []) {
    const config = (configs ?? []).find((c) => c.empresa_id === empresa.id)
    if (!config?.notificar_whatsapp || !config?.webhook_url) continue

    const limite = new Date(agora.getTime() + (config.antecedencia_horas ?? 24) * 60 * 60 * 1000)

    const { data: tarefas } = await supabase
      .from('tarefas')
      .select('id, titulo, prazo, setor_id, responsavel_tipo, responsavel_id, status')
      .eq('empresa_id', empresa.id)
      .in('status', ['pendente', 'andamento'])
      .lte('prazo', limite.toISOString())

    const atrasadas = (tarefas ?? []).filter((t) => new Date(t.prazo).getTime() < agora.getTime())
    const vencemHoje = (tarefas ?? []).filter((t) => new Date(t.prazo).getTime() >= agora.getTime())

    if (atrasadas.length > 0 || vencemHoje.length > 0) {
      try {
        await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: { id: empresa.id, nome: empresa.nome },
            atrasadas,
            vencemHoje,
            geradoEm: agora.toISOString(),
          }),
        })
        notificadas++
      } catch (e) {
        console.error(`Falha ao chamar webhook da empresa ${empresa.nome}:`, e)
      }
    }
  }

  return new Response(JSON.stringify({ geradas, empresasNotificadas: notificadas }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
