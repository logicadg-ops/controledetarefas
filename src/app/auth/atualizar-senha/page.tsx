import { definirSenha } from './actions'

export default async function AtualizarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Defina sua senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha uma senha para acessar o Painel de Tarefas.
        </p>

        {erro && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
        )}

        <form action={definirSenha} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nova senha</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirmar senha</label>
            <input
              name="confirmacao"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Salvar e entrar
          </button>
        </form>
      </div>
    </div>
  )
}
