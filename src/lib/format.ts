import type { DayKey, OpeningHours } from './types'

export const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

/** Só dígitos. Ex.: "(75) 99212-4505" -> "75992124505" */
export const onlyDigits = (v: string) => v.replace(/\D/g, '')

export const formatPhone = (digits: string) => {
  const d = onlyDigits(digits).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Aberto agora? Considera fechamento à meia-noite ("00:00") e após a virada do dia. */
export function isOpenNow(hours: OpeningHours, now = new Date()): boolean {
  const today = hours[DAY_KEYS[now.getDay()]]
  const yesterday = hours[DAY_KEYS[(now.getDay() + 6) % 7]]
  const cur = now.getHours() * 60 + now.getMinutes()

  if (today) {
    const open = toMin(today.open)
    const close = toMin(today.close)
    if (close > open ? cur >= open && cur < close : cur >= open) return true
  }
  if (yesterday) {
    const open = toMin(yesterday.open)
    const close = toMin(yesterday.close)
    if (close <= open && close !== 0 && cur < close) return true
  }
  return false
}
