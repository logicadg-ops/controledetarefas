import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Gera um link assinado (curta duração) para o arquivo e redireciona.
// A visibilidade é a mesma da tabela tarefa_anexos (RLS): se a consulta não
// devolver a linha, a pessoa não tinha permissão para ver este anexo.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: anexo } = await supabase
    .from('tarefa_anexos')
    .select('caminho, nome_arquivo')
    .eq('id', params.id)
    .maybeSingle()

  if (!anexo) {
    return NextResponse.json({ error: 'Anexo não encontrado ou sem permissão.' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from('tarefa-anexos')
    .createSignedUrl(anexo.caminho, 60, { download: anexo.nome_arquivo })

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao gerar link de download.' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
