import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Cliente, Setor, Usuario } from '@/lib/types'
import { criarTarefa } from '../actions'

export default async function NovaTarefaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await createClient()
  const usuario = await getUsuarioLogado()

  let setores: Setor[] = []
  let usuarios: Usuario[] = []
  if (usuario?.role === 'admin') {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.from('setores').select('*').eq('ativo', true).order('nome'),
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
    ])
    setores = (s ?? []) as Setor[]
    usuarios = (u ?? []) as Usuario[]
  }

  const { data: clientesData } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome')
  const clientes = (clientesData ?? []) as Cliente[]

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Nova tarefa</h1>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {usuario?.role !== 'admin' && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Esta tarefa será criada para você, no setor {usuario?.setor_nome ?? '—'}. Administradores
          também poderão acompanhá-la.
        </p>
      )}

      <form action={criarTarefa} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Título</label>
          <input
            name="titulo"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Descrição</label>
          <textarea
            name="descricao"
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Cliente</label>
          <select
            name="cliente_id"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Nenhum</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {usuario?.role === 'admin' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700">Setor</label>
              <select
                name="setor_id"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Demandar para</label>
                <select
                  name="responsavel_tipo"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="usuario">Pessoa</option>
                  <option value="setor">Setor inteiro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Pessoa</label>
                <select
                  name="responsavel_id"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Prazo</label>
            <input
              type="date"
              name="prazo_data"
              defaultValue={hoje}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Hora</label>
            <input
              type="time"
              name="prazo_hora"
              defaultValue="18:00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Meta</label>
            <input
              type="date"
              name="meta_data"
              defaultValue={hoje}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Hora</label>
            <input
              type="time"
              name="meta_hora"
              defaultValue="16:00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <p className="col-span-3 -mt-1 text-xs text-slate-400">
            Data/hora interna, anterior ao prazo, para estimular a conclusão antecipada.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Prioridade</label>
          <select
            name="prioridade"
            defaultValue="media"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Criar tarefa
        </button>
      </form>
    </div>
  )
}
