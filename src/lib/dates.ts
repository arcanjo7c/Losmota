export type Range = 'today' | '7d' | '30d'

export const RANGE_LABEL: Record<Range, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
}

/** Intervalo [from, to) em ISO, usando o fuso do aparelho. `to` = início de amanhã. */
export function rangeBounds(range: Range) {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  if (range === '7d') from.setDate(from.getDate() - 6)
  if (range === '30d') from.setDate(from.getDate() - 29)
  const to = new Date()
  to.setHours(0, 0, 0, 0)
  to.setDate(to.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}
