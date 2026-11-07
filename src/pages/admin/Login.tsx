import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAdmin } from '@/lib/adminAuth'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Login() {
  const { session, profile, signIn } = useAdmin()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && profile) return <Navigate to="/admin" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/admin', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <img src="/brand/logo-los-motta.png" alt="Los Motta Pizzaria" width={96} height={96} className="mx-auto rounded-full shadow-glow" />
      <h1 className="text-center text-3xl font-black">Painel Los Motta</h1>

      {!isSupabaseConfigured && (
        <p role="alert" className="surface p-4 text-sm text-motta-soft">Supabase não configurado. Preencha o arquivo .env.local.</p>
      )}

      <form onSubmit={onSubmit} className="surface flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          E-mail
          <input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Senha
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}
        {session && !profile && (
          <p role="alert" className="text-sm text-motta-soft">Este usuário ainda não tem acesso ao painel. Peça ao proprietário para liberar.</p>
        )}
        <button className="btn-gold" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
