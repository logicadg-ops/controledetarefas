import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { ConfigGeral } from '@/lib/types'
import { salvarConfig, testarWhatsapp } from './actions'

export const dynamic = 'force-dynamic'

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}) {
  const { erro, aviso } = await searchParams
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('config_geral').select('*').single()
  const config = data as ConfigGeral

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">
          Avisos de tarefas atrasadas ou que vencem em breve, enviados uma vez por dia.
        </p>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {aviso && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</div>}

      <form action={salvarConfig} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Antecedência (horas)</label>
          <input
            name="antecedencia_horas"
            type="number"
            min={1}
            defaultValue={config?.antecedencia_horas}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            Quantas horas antes do prazo a tarefa entra no aviso de &ldquo;vence hoje&rdquo;.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="notificar_whatsapp" defaultChecked={config?.notificar_whatsapp} />
          Enviar notificações
        </label>

        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">WhatsApp — cada responsável no próprio número</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Via Z-API (ou serviço equivalente). Cole aqui a URL da instância, do jeito que aparece no
              painel do provedor. O número de cada pessoa vem do cadastro em Usuários.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">URL da instância</label>
            <input
              name="zapi_instance_url"
              defaultValue={config?.zapi_instance_url ?? ''}
              placeholder="https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Client-Token <span className="font-normal text-slate-400">(se a conta tiver essa segurança ativada)</span>
            </label>
            <input
              name="zapi_client_token"
              type="password"
              defaultValue={config?.zapi_client_token ?? ''}
              placeholder="••••••••"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Webhook extra <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            name="webhook_url"
            defaultValue={config?.webhook_url}
            placeholder="https://seu-n8n.exemplo.com/webhook/tarefas"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            Se preenchido, a rotina diária também manda os dados brutos aqui (ex.: para um fluxo próprio
            no n8n/Make). Não é necessário para o WhatsApp acima funcionar.
          </p>
        </div>

        <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Salvar
        </button>
      </form>

      <form
        action={testarWhatsapp}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">Testar envio</label>
          <input
            name="telefone_teste"
            placeholder="81999999999"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">Salve a URL da instância acima antes de testar.</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Enviar teste
        </button>
      </form>
    </div>
  )
}
