import { MapPin, Clock } from 'lucide-react'
import { useUnits } from '@/hooks/useUnits'
import { formatPhone, isOpenNow } from '@/lib/format'

/** Etapa 1: verifica tema + conexão com o Supabase. A Home completa vem na etapa 2. */
export default function Home() {
  const { units, loading, error } = useUnits()

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center gap-8 px-5 py-12">
      <img src="/brand/logo-los-motta.png" alt="Los Motta Pizzaria, 20 anos" width={140} height={140} className="rounded-full shadow-glow" />
      <h1 className="text-center text-4xl font-black leading-tight">Pedidos online<br />em construção</h1>

      {loading && <p className="text-bone/60">Carregando unidades…</p>}
      {error && <p role="alert" className="surface w-full p-4 text-center text-motta-soft">{error}</p>}

      <ul className="flex w-full flex-col gap-3">
        {units.map((u) => (
          <li key={u.id} className="surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold">{u.name}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOpenNow(u.opening_hours) ? 'bg-motta text-bronze-900' : 'bg-ink-700 text-bone/70'}`}>
                {isOpenNow(u.opening_hours) ? 'Aberto agora' : 'Fechado'}
              </span>
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm text-bone/75">
              <MapPin size={16} className="mt-0.5 shrink-0 text-motta" />
              {u.address ?? 'Endereço a cadastrar no painel'}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-bone/75">
              <Clock size={16} className="shrink-0 text-motta" />
              {u.whatsapp ? `WhatsApp ${formatPhone(u.whatsapp)}` : 'WhatsApp a cadastrar no painel'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
