export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayHours = { open: string; close: string } | null
export type OpeningHours = Partial<Record<DayKey, DayHours>>

export interface Unit {
  id: string
  slug: string
  name: string
  city: string
  whatsapp: string | null
  address: string | null
  maps_url: string | null
  opening_hours: OpeningHours
  delivery_enabled: boolean
  pickup_enabled: boolean
  min_order: number
  estimated_minutes: number | null
  is_active: boolean
}

export type OrderStatus =
  | 'awaiting_confirmation' | 'confirmed' | 'preparing'
  | 'out_for_delivery' | 'completed' | 'cancelled'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_confirmation: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  preparing: 'Em preparação',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export type PaymentMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
}

export type AdminRole = 'owner' | 'unit_manager'

export interface AdminProfile {
  user_id: string
  role: AdminRole
  unit_id: string | null
  name: string | null
}

export interface OrderItem {
  id: string
  name: string
  size_name: string | null
  flavors: unknown[]
  crust_name: string | null
  addons: unknown[]
  quantity: number
  total_price: number
  notes: string | null
}

export interface Order {
  id: string
  order_number: number
  unit_id: string
  status: OrderStatus
  customer_name: string
  customer_phone: string
  fulfillment: 'delivery' | 'pickup'
  address: string | null
  neighborhood: string | null
  reference: string | null
  payment_method: PaymentMethod
  change_for: number | null
  notes: string | null
  coupon_code: string | null
  subtotal: number
  delivery_fee: number
  discount: number
  total: number
  created_at: string
  order_items: OrderItem[]
}

export interface DashboardStats {
  total_orders: number
  by_status: Partial<Record<OrderStatus, number>>
  revenue: number
  revenue_completed: number
  avg_ticket: number
  by_unit: { unit_id: string; orders: number; revenue: number }[]
  by_day: { day: string; orders: number; revenue: number }[]
  top_products: { name: string; qty: number }[]
}
