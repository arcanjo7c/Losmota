import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Unit } from '@/lib/types'

export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : 'Supabase não configurado. Preencha o arquivo .env.local.',
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    supabase
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError('Não foi possível carregar as unidades. Tente novamente.')
        else setUnits((data ?? []) as Unit[])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  return { units, loading, error }
}
