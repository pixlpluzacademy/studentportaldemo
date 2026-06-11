import { createClient } from '@/lib/supabase/client'

/** Browser Supabase client singleton for legacy imports. */
export const supabase = createClient()

export { createClient }
