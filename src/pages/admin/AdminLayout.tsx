import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { LayoutDashboard, LogOut, ReceiptText } from 'lucide-react'
import { useAdmin } from '@/lib/adminAuth'
import { useUnits } from '@/hooks/useUnits'
import type { Unit } from '@/lib/types'

export interface AdminOutletContext { units: Unit[] }

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
    isActive ? 'bg-gold-sheen text-bronze-900' : 'text-bone/75 hover:text-motta'
  }`

export default function AdminLayout() {
  const { session, profile, loading, signOut } = useAdmin()
  const { units } = useUnits()

  if (loading) return <p className="p-10 text-center text-bone/60">Carregando…</p>
  if (!session) return <Navigate to="/admin/login" replace />
  if (!profile) {
    return (
      <main className="mx-auto max-w-sm p-10 text-center">
        <p className="surface mb-4 p-5">Seu usuário ainda não tem acesso ao painel. Peça ao proprietário para liberar.</p>
        <button className="btn-ghost" onClick={() => void signOut()}>Sair</button>
      </main>
    )
  }

  const myUnit = profile.unit_id ? units.find((u) => u.id === profile.unit_id) : null
  const scope = profile.role === 'owner' ? 'Proprietário · todas as unidades' : `Responsável · ${myUnit?.name ?? 'sua unidade'}`

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-3 py-5">
        <img src="/brand/logo-los-motta.png" alt="" width={44} height={44} className="rounded-full" />
        <div className="mr-auto leading-tight">
          <p className="font-display text-lg font-extrabold">Painel Los Motta</p>
          <p className="text-xs text-bone/60">{profile.name ? `${profile.name} · ` : ''}{scope}</p>
        </div>
        <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => void signOut()} aria-label="Sair do painel">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <nav className="mb-6 flex gap-2" aria-label="Seções do painel">
        <NavLink to="/admin" end className={tab}><LayoutDashboard size={16} /> Dashboard</NavLink>
        <NavLink to="/admin/pedidos" className={tab}><ReceiptText size={16} /> Pedidos</NavLink>
      </nav>

      <Outlet context={{ units } satisfies AdminOutletContext} />
    </div>
  )
}
