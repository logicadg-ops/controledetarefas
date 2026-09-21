'use client'

export function BotaoExcluirTarefa({
  action,
  titulo,
  recorrente,
}: {
  action: () => void | Promise<void>
  titulo: string
  recorrente: boolean
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const aviso = recorrente
          ? ' Ela é de uma recorrência: não será recriada neste período, mas volta normalmente no próximo.'
          : ''
        if (!confirm(`Excluir a tarefa "${titulo}"? Esta ação não pode ser desfeita.${aviso}`)) {
          e.preventDefault()
        }
      }}
    >
      <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
        Excluir
      </button>
    </form>
  )
}
