// Formato da planilha de importação em massa de recorrências.
// Usado tanto para gerar o modelo (download) quanto para ler o upload —
// mantém as duas pontas sempre em sincronia.

export const CABECALHOS = {
  titulo: 'Título',
  descricao: 'Descrição',
  setor: 'Setor',
  cliente: 'Cliente',
  responsavel: 'Responsável',
  frequencia: 'Frequência',
  diasSemana: 'Dias da semana',
  diaMes: 'Dia do mês',
  prazoHora: 'Hora do prazo',
  metaHora: 'Hora da meta',
  prioridade: 'Prioridade',
} as const

export const ORDEM_COLUNAS = [
  'titulo',
  'descricao',
  'setor',
  'cliente',
  'responsavel',
  'frequencia',
  'diasSemana',
  'diaMes',
  'prazoHora',
  'metaHora',
  'prioridade',
] as const satisfies readonly (keyof typeof CABECALHOS)[]

/** Remove acentos, baixa a caixa e apara espaços — usado para comparar nomes/textos digitados livremente. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export const ALIASES_FREQUENCIA: Record<string, 'diaria' | 'semanal' | 'mensal'> = {
  diaria: 'diaria',
  semanal: 'semanal',
  mensal: 'mensal',
}

export const ALIASES_PRIORIDADE: Record<string, 'baixa' | 'media' | 'alta'> = {
  baixa: 'baixa',
  media: 'media',
  alta: 'alta',
}

// Chave já normalizada (sem acento) -> número do dia (0=domingo .. 6=sábado),
// igual ao usado no restante do sistema (DIAS_SEMANA_LABEL).
export const ALIASES_DIA_SEMANA: Record<string, number> = {
  '0': 0,
  domingo: 0,
  dom: 0,
  '1': 1,
  segunda: 1,
  'segunda-feira': 1,
  seg: 1,
  '2': 2,
  terca: 2,
  'terca-feira': 2,
  ter: 2,
  '3': 3,
  quarta: 3,
  'quarta-feira': 3,
  qua: 3,
  '4': 4,
  quinta: 4,
  'quinta-feira': 4,
  qui: 4,
  '5': 5,
  sexta: 5,
  'sexta-feira': 5,
  sex: 5,
  '6': 6,
  sabado: 6,
  sab: 6,
}
