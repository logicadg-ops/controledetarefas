import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import type { Setor, Usuario } from '@/lib/types'
import { criarUsuario } from './actions'
import { LinhaUsuario } from './linha-usuario'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}) {
  const { erro, aviso } = await searchParams
  const usuarioLogado = await getUsuarioLogado()
  if (usuarioLogado?.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: u }, { data: s }] = await Promise.all([
    supabase.from('usuarios').select('*, setores(nome)').order('nome'),
    supabase.from('setores').select('*').eq('ativo', true).order('nome'),
  ])
  const usuarios = (u ?? []) as (Usuario & { setores: { nome: string } | null })[]
  const setores = (s ?? []) as Setor[]
  const ativos = usuarios.filter((x) => x.ativo).length
  const inativos = usuarios.length - ativos

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {aviso && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</div>}

      <form
        action={criarUsuario}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <input
          name="nome"
          placeholder="Nome"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          name="cargo"
          placeholder="Cargo (opcional)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          name="whatsapp"
          placeholder="WhatsApp (opcional), ex.: 81999999999"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          name="setor_id"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Sem setor</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue="comum"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="comum">Usuário comum</option>
          <option value="admin">Administrador</option>
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-2">
          Cadastrar usuário
        </button>
      </form>

      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{usuarios.length}</span>{' '}
        {usuarios.length === 1 ? 'usuário' : 'usuários'} no total · {ativos} {ativos === 1 ? 'ativo' : 'ativos'} ·{' '}
        {inativos} {inativos === 1 ? 'inativo' : 'inativos'}
      </p>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {usuarios.map((u) => (
          <LinhaUsuario key={u.id} usuario={u} setores={setores} />
        ))}
      </div>
    </div>
  )
}
