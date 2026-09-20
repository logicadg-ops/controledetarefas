import { login, recuperarSenha } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>
}) {
  const { erro, aviso } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Painel de Tarefas</h1>
        <p className="mt-1 text-sm text-slate-500">Condomais PE — controle de tarefas da equipe</p>

        {erro && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
        )}
        {aviso && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {aviso}
          </div>
        )}

        <form action={login} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Senha</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Entrar
          </button>
        </form>

        <details className="mt-4 text-sm text-slate-500">
          <summary className="cursor-pointer select-none">Esqueci minha senha</summary>
          <form action={recuperarSenha} className="mt-3 flex gap-2">
            <input
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Enviar
            </button>
          </form>
        </details>

        <p className="mt-6 text-xs text-slate-400">
          Novo por aqui? Peça a um administrador para cadastrar você em Usuários — você vai
          receber um convite por e-mail para criar sua senha.
        </p>
      </div>
    </div>
  )
}
