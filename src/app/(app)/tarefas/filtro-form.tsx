'use client'

// Envia o formulário sozinho assim que qualquer campo (select) muda,
// sem precisar clicar em "Filtrar". O botão continua funcionando normalmente.
export function FiltroForm({
  action,
  className,
  children,
}: {
  action: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <form action={action} className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  )
}
