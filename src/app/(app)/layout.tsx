import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUsuarioLogado } from '@/lib/data'
import { logout } from '@/app/login/actions'
import { SeletorEmpresa } from './seletor-empresa'

const NAV_TODOS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tarefas', label: 'Tarefas' },
]

const NAV_ADMIN = [
  { href: '/recorrentes', label: 'Recorrentes' },
  { href: '/setores', label: 'Setores' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/usuarios', label: 'Usuários' },
  { href: '/config', label: 'Configurações' },
]

const NAV_PLATAFORMA = { href: '/empresas', label: 'Empresas' }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioLogado()

  if (!usuario) {
    // Sessão do Supabase Auth existe, mas não há registro em "usuarios" com
    // esse e-mail (ver trigger link_usuario_on_signup). Provavelmente a
    // pessoa ainda não foi cadastrada por um admin.
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">Conta ainda não vinculada</h1>
          <p className="mt-2 text-sm text-amber-800">
            Seu login foi confirmado, mas nenhum cadastro em &ldquo;Usuários&rdquo; usa este
            e-mail. Peça a um administrador para cadastrar seu e-mail no painel.
          </p>
          <form action={logout} className="mt-4">
            <button className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100">
              Sair
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!usuario.ativo) {
    redirect('/login?erro=Seu+acesso+foi+desativado.+Fale+com+um+administrador.')
  }

  const nav = [
    ...NAV_TODOS,
    ...(usuario.role === 'admin' ? NAV_ADMIN : []),
    ...(usuario.plataforma_admin ? [NAV_PLATAFORMA] : []),
  ]

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                Painel de Tarefas
              </span>
              {usuario.empresas.length > 1 ? (
                <SeletorEmpresa empresas={usuario.empresas} atual={usuario.empresa_id} />
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {usuario.empresa_nome}
                </span>
              )}
            </div>
            <nav className="hidden gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-none text-slate-900">{usuario.nome}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {usuario.role === 'admin' ? 'Administrador' : usuario.setor_nome ?? 'Sem setor'}
              </p>
            </div>
            <form action={logout}>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
