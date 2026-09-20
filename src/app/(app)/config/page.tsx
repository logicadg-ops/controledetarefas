import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { ConfigGeral } from '@/lib/types'
import { salvarConfig } from './actions'

export const dynamic = 'force-dynamic'

export default async function ConfigPage() {
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
          Webhook usado pela rotina diária para enviar notificações de tarefas atrasadas ou que
          vencem hoje (ex: para um fluxo n8n que dispara mensagens de WhatsApp).
        </p>
      </div>

      <form action={salvarConfig} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">URL do webhook</label>
          <input
            name="webhook_url"
            defaultValue={config?.webhook_url}
            placeholder="https://seu-n8n.exemplo.com/webhook/tarefas"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
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
          <input
            type="checkbox"
            name="notificar_whatsapp"
            defaultChecked={config?.notificar_whatsapp}
          />
          Enviar notificações via WhatsApp (webhook)
        </label>
        <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Salvar
        </button>
      </form>
    </div>
  )
}
