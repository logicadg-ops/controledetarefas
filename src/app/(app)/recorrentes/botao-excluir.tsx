'use client'

export function BotaoExcluir({ action, titulo }: { action: () => void | Promise<void>; titulo: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir a recorrência "${titulo}"? As tarefas já geradas permanecem, mas nada mais será criado.`)) {
          e.preventDefault()
        }
      }}
    >
      <button className="rounded-full px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Excluir</button>
    </form>
  )
}
