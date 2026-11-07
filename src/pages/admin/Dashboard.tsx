import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/lib/adminAuth'
import { RANGE_LABEL, rangeBounds, type Range } from '@/lib/dates'
import { brl } from '@/lib/format'
import { ORDER_STATUS_LABEL, type DashboardStats, type OrderStatus } from '@/lib/types'
import type { AdminOutletContext } from './AdminLayout'

const STATUS_CARDS: OrderStatus[] = ['awaiting_confirmation', 'preparing', 'out_for_delivery', 'completed']
const STATUS_CARD_LABEL: Partial<Record<OrderStatus, string>> = {
  awaiting_confirmation: 'Recebidos (aguardando)',
  preparing: 'Em preparação',
  out_for_delivery: 'Enviados',
  completed: 'Concluídos',
}

function Card({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="surface p-4">
      <p className="text-sm text-bone/65">{title}</p>
      <p className="mt-1 font-display text-3xl font-black text-motta">{value}</p>
      {hint && <p className="mt-1 text-xs text-bone/50">{hint}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { units } = useOutletContext<AdminOutletContext>()
  const { profile } = useAdmin()
  const isOwner = profile?.role === 'owner'

  const [range, setRange] = useState<Range>('today')
  const [unit, setUnit] = useState<string>('all')
  const unitParam = isOwner ? (unit === 'all' ? null : unit) : profile?.unit_id ?? null

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const unitName = useMemo(() => new Map(units.map((u) => [u.id, u.name.replace('Los Motta · ', '')])), [units])

  useEffect(() => {
    let alive = true
    const { from, to } = rangeBounds(range)
    setStats(null)
    supabase.rpc('dashboard_stats', { p_from: from, p_to: to, p_unit: unitParam }).then(({ data, error: err }) => {
      if (!alive) return
      if (err) setError('Não foi possível carregar o dashboard.')
      else { setStats(data as DashboardStats); setError(null) }
    })
    return () => { alive = false }
  }, [range, unitParam])

  const maxDay = Math.max(1, ...(stats?.by_day ?? []).map((d) => d.revenue))

  return (
    <section aria-labelledby="dash-title">
      <h1 id="dash-title" className="sr-only">Dashboard</h1>

      <div className="mb-5 flex flex-wrap gap-3">
        {isOwner && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-bone/60">Unidade</span>
            <select className="field !w-auto !py-2" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="all">Todas</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.city}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-bone/60">Período</span>
          <select className="field !w-auto !py-2" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="surface p-4 text-red-300">{error}</p>}
      {!stats && !error && <p className="text-bone/60">Carregando…</p>}

      {stats && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card title="Total de pedidos" value={stats.total_orders} />
            <Card title="Faturamento" value={brl(stats.revenue)} hint="Pedidos não cancelados" />
            <Card title="Ticket médio" value={brl(stats.avg_ticket)} />
            {STATUS_CARDS.map((s) => <Card key={s} title={STATUS_CARD_LABEL[s] ?? ORDER_STATUS_LABEL[s]} value={stats.by_status[s] ?? 0} />)}
            <Card title="Cancelados" value={stats.by_status.cancelled ?? 0} />
          </div>

          {isOwner && unit === 'all' && stats.by_unit.length > 0 && (
            <div className="surface p-5">
              <h2 className="mb-3 text-xl font-extrabold">Comparativo entre unidades</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {stats.by_unit.map((u) => (
                  <li key={u.unit_id} className="rounded-2xl bg-ink-800 p-4">
                    <p className="font-bold">{unitName.get(u.unit_id) ?? 'Unidade'}</p>
                    <p className="text-sm text-bone/70">{u.orders} pedidos · {brl(u.revenue)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="surface p-5">
            <h2 className="mb-4 text-xl font-extrabold">Faturamento por dia</h2>
            {stats.by_day.length === 0 ? (
              <p className="text-bone/60">Sem pedidos no período.</p>
            ) : (
              <ul className="flex h-44 items-end gap-2 overflow-x-auto" aria-label="Faturamento por dia">
                {stats.by_day.map((d) => (
                  <li key={d.day} className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[11px] text-bone/70">{brl(d.revenue)}</span>
                    <div className="w-full rounded-t-lg bg-gold-sheen" style={{ height: `${Math.max(4, (d.revenue / maxDay) * 100)}%` }} title={`${d.orders} pedidos`} />
                    <span className="text-[11px] text-bone/60">{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface p-5">
            <h2 className="mb-3 text-xl font-extrabold">Mais vendidos</h2>
            {stats.top_products.length === 0 ? (
              <p className="text-bone/60">Sem vendas no período.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {stats.top_products.map((p) => (
                  <li key={p.name} className="flex justify-between gap-3 rounded-xl bg-ink-800 px-4 py-2.5">
                    <span>{p.name}</span>
                    <strong className="text-motta">{p.qty}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
