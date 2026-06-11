export type DataSource = 'supabase' | 'loading'

export type DataResult<T> = {
  data: T
  source: 'supabase'
  error?: string | null
}
