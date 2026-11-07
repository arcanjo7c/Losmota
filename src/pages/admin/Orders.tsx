import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Bike, ChevronDown, MessageCircle, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/lib/adminAuth'
import { RANGE_LABEL, rangeBounds, type Range } from '@/lib/dates'
import { brl, formatPhone, onlyDigits } from '@/lib/format'
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, type Order, type OrderStatus } from '@/lib/types'
import type { AdminOutletContext } from './AdminLayout'

const ACTIVE: OrderStatus[] = ['awaiting_confirmation', 'confirmed', 'preparing', 'out_for_delivery']

const STATUS_STYLE: Record<OrderStatus, string> = {
  awaiting_confirmation: 'bg-motta text-bronze-900',
  confirmed: 'bg-bronze-500 text-bone',
  preparing: 'bg-bronze-700 text-bone',
  out_for_delivery: 'bg-ink-700 text-motta-soft',
  completed: 'bg-emerald-900/70 text-emerald-200',
  cancelled: 'bg-red-950 text-red-300',
}

function nextStep(o: Order): { to: OrderStatus; label: string } | null {
  switch (o.status) {
    case 'awaiting_confirmation': return { to: 'confirmed', label: 'Confirmar pedido' }
    case 'confirmed': return { to: 'preparing', label: 'Iniciar preparo' }
    case 'preparing':
      return o.fulfillment === 'delivery'
        ? { to: 'out_for_delivery', label: 'Saiu para entrega' }
        : { to: 'completed', label: 'Retirado pelo cliente' }
    case 'out_for_delivery': return { to: 'completed', label: 'Concluir pedido' }
    default: return null
  }
}

const label = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name)
  return ''
}

const waLink = (phone: string) => {
  const d = onlyDigits(phone)
  return `https://wa.me/${d.startsWith('55') && d.length >= 12 ? d : `55${d}`}`
}

export default function Orders() {
  const { units } = useOutletContext<AdminOutletContext>()
  const { profile } = useAdmin()
  const isOwner = profile?.role === 'owner'

  // Proprietário escolhe a aba (todas / Araci / Teofilândia). Responsável fica travado na sua unidade.
  const [unitTab, setUnitTab] = useState<string>('all')
  const unitFilter = isOwner ? (unitTab === 'all' ? null : unitTab) : profile?.unit_id ?? null

  const [range, setRange] = useState<Range>('today')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | OrderStatus>('active')
  const [orders, setOrders] = useState<Order[]>([])
  const [pending, setPending] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const seen = useRef<Set<string> | null>(null)

  const unitName = useMemo(() => new Map(units.map((u) => [u.id, u.name.replace('Los Motta · ', '')])), [units])

  const load = useCallback(async () => {
    const { from, to } = rangeBounds(range)
    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
    if (unitFilter) q = q.eq('unit_id', unitFilter)
    const { data, error: err } = await q
    if (err) { setError('Não foi possível carregar os pedidos.'); setLoading(false); return }
    const list = (data ?? []) as Order[]
    setOrders(list)
    setError(null)
    setLoading(false)

    // destaca pedidos que chegaram depois da primeira carga
    const ids = new Set(list.map((o) => o.id))
    if (seen.current) {
      const novos = list.filter((o) => !seen.current!.has(o.id)).map((o) => o.id)
      if (novos.length) {
        setFresh((prev) => new Set([...prev, ...novos]))
        setTimeout(() => setFresh((prev) => { const n = new Set(prev); novos.forEach((i) => n.delete(i)); return n }), 10000)
      }
    }
    seen.current = ids

    // contador de "aguardando confirmação" por unidade (para as abas)
    const { data: p } = await supabase.from('orders').select('unit_id').eq('status', 'awaiting_confirmation')
    const counts: Record<string, number> = {}
    ;(p ?? []).forEach((r: { unit_id: string }) => { counts[r.unit_id] = (counts[r.unit_id] ?? 0) + 1 })
    setPending(counts)
  }, [range, unitFilter])

  useEffect(() => { seen.current = null; setLoading(true); void load() }, [load])

  // Pedidos em tempo real (o RLS já filtra o que cada pessoa pode receber)
  useEffect(() => {
    const ch = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [load])

  async function setStatus(o: Order, to: OrderStatus) {
    if (to === 'cancelled' && !window.confirm(`Cancelar o pedido #${o.order_number}?`)) return
    const { error: err } = await supabase.from('orders').update({ status: to }).eq('id', o.id)
    if (err) setError('Não foi possível atualizar o pedido. Tente novamente.')
    else void load()
  }

  const visible = orders.filter((o) =>
    statusFilter === 'all' ? true : statusFilter === 'active' ? ACTIVE.includes(o.status) : o.status === statusFilter,
  )
  const totalPending = Object.values<number>(pending).reduce((a, b) => a + b, 0)

  return (
    <section aria-labelledby="orders-title">
      <h1 id="orders-title" className="sr-only">Pedidos</h1>

      {isOwner ? (
        <div role="tablist" aria-label="Unidade" className="mb-4 flex flex-wrap gap-2">
          {[{ id: 'all', name: 'Todas as unidades', n: totalPending }, ...units.map((u) => ({ id: u.id, name: u.city, n: pending[u.id] ?? 0 }))].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={unitTab === t.id}
              onClick={() => setUnitTab(t.id)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                unitTab === t.id ? 'border-motta bg-motta/10 text-motta' : 'border-ink-700 text-bone/75 hover:border-motta/60'
              }`}
            >
              {t.name}
              {t.n > 0 && <span className="rounded-full bg-motta px-2 py-0.5 text-xs text-bronze-900">{t.n}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-bone/70">Pedidos da unidade {unitFilter ? unitName.get(unitFilter) ?? '' : ''}</p>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-bone/60">Período</span>
          <select className="field !w-auto !py-2" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-bone/60">Status</span>
          <select className="field !w-auto !py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="active">Em andamento</option>
            <option value="all">Todos</option>
            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="surface mb-4 p-4 text-sm text-red-300">{error}</p>}
      {loading && <p className="text-bone/60">Carregando pedidos…</p>}
      {!loading && visible.length === 0 && !error && (
        <p className="surface p-8 text-center text-bone/60">Nenhum pedido neste filtro. Novos pedidos aparecem aqui sozinhos.</p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((o) => {
          const open = openId === o.id
          const step = nextStep(o)
          return (
            <li key={o.id} className={`surface overflow-hidden transition ${fresh.has(o.id) ? 'ring-2 ring-motta' : ''}`}>
              <button
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : o.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-extrabold">#{o.order_number}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                    {isOwner && <span className="text-xs text-bone/50">{unitName.get(o.unit_id)}</span>}
                  </p>
                  <p className="mt-1 truncate text-sm text-bone/80">
                    {o.customer_name} · {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {o.fulfillment === 'delivery' ? ' · Entrega' : ' · Retirada'}
                  </p>
                </div>
                <span className="font-bold text-motta">{brl(o.total)}</span>
                <ChevronDown size={18} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-ink-700 p-4 text-sm">
                  <ul className="mb-4 flex flex-col gap-2">
                    {o.order_items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3">
                        <span>
                          <strong>{i.quantity}x {i.name}</strong>
                          {i.size_name && ` · ${i.size_name}`}
                          {i.flavors.length > 0 && <span className="block text-bone/70">Sabores: {i.flavors.map(label).join(', ')}</span>}
                          {i.crust_name && <span className="block text-bone/70">Borda: {i.crust_name}</span>}
                          {i.addons.length > 0 && <span className="block text-bone/70">Adicionais: {i.addons.map(label).join(', ')}</span>}
                          {i.notes && <span className="block text-motta-soft">Obs.: {i.notes}</span>}
                        </span>
                        <span className="shrink-0">{brl(i.total_price)}</span>
                      </li>
                    ))}
                  </ul>

                  <dl className="grid gap-1.5 rounded-xl bg-ink-800 p-3">
                    <div className="flex justify-between"><dt className="text-bone/60">Subtotal</dt><dd>{brl(o.subtotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-bone/60">Taxa de entrega</dt><dd>{brl(o.delivery_fee)}</dd></div>
                    {o.discount > 0 && <div className="flex justify-between"><dt className="text-bone/60">Desconto{o.coupon_code ? ` (${o.coupon_code})` : ''}</dt><dd>- {brl(o.discount)}</dd></div>}
                    <div className="flex justify-between font-bold"><dt>Total</dt><dd className="text-motta">{brl(o.total)}</dd></div>
                  </dl>

                  <div className="mt-4 grid gap-1.5 text-bone/85">
                    <p className="flex items-center gap-2">
                      {o.fulfillment === 'delivery' ? <Bike size={16} className="text-motta" /> : <Store size={16} className="text-motta" />}
                      {o.fulfillment === 'delivery' ? `${o.address} · ${o.neighborhood}` : 'Retirada na loja'}
                    </p>
                    {o.reference && <p>Referência: {o.reference}</p>}
                    <p>Pagamento: {PAYMENT_LABEL[o.payment_method]}{o.change_for ? ` · troco para ${brl(o.change_for)}` : ''}</p>
                    {o.notes && <p className="text-motta-soft">Obs. do pedido: {o.notes}</p>}
                    <a className="inline-flex w-fit items-center gap-2 font-semibold text-motta hover:underline" href={waLink(o.customer_phone)} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} /> {formatPhone(o.customer_phone)}
                    </a>
                  </div>

                  {(step || ACTIVE.includes(o.status)) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {step && <button className="btn-gold !py-2.5" onClick={() => void setStatus(o, step.to)}>{step.label}</button>}
                      {ACTIVE.includes(o.status) && <button className="btn-ghost !py-2.5 hover:!border-red-400 hover:!text-red-300" onClick={() => void setStatus(o, 'cancelled')}>Cancelar</button>}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
