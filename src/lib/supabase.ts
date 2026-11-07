import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anon)

// Só a chave "anon" fica no front-end. A segurança real está nas políticas RLS.
export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anon ?? 'chave-nao-configurada',
  { auth: { persistSession: true, autoRefreshToken: true } },
)
