import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Recorrente, Setor, Usuario } from '@/lib/types'
import { atualizarRecorrente } from '../actions'
import { RecorrenteForm } from '../recorrente-form'

export const dynamic = 'force-dynamic'

export default async function EditarRecorrentePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { erro?: string }
}) {
  const { erro } = searchParams
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: r }, { data: s }, { data: u }, { data: c }] = await Promise.all([
    supabase.from('recorrentes').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('setores').select('*').eq('ativo', true).order('nome'),
    supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
  ])
  if (!r) notFound()

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/recorrentes" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">Editar recorrência</h1>
        <p className="text-sm text-slate-500">
          A alteração vale para as próximas tarefas e para as já criadas que ainda não foram iniciadas.
        </p>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <RecorrenteForm
        action={atualizarRecorrente.bind(null, params.id)}
        setores={(s ?? []) as Setor[]}
        usuarios={(u ?? []) as Usuario[]}
        clientes={(c ?? []) as Cliente[]}
        recorrente={r as Recorrente}
        submitLabel="Salvar alterações"
      />
    </div>
  )
}
