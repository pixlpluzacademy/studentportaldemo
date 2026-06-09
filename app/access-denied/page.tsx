import Link from 'next/link'
import { Lock } from 'lucide-react'

export default function AccessDeniedPage() {
  return <div className="flex min-h-[70vh] items-center justify-center"><div className="max-w-md border border-border bg-card p-8 text-center"><Lock className="mx-auto mb-4 h-10 w-10 text-red-500" /><h1 className="text-2xl font-bold">Access Denied</h1><p className="mt-2 text-muted-foreground">Your role does not have permission for this page.</p><Link href="/dashboard" className="mt-6 inline-flex bg-[#153e90] px-5 py-3 font-semibold text-white">Back to Dashboard</Link></div></div>
}
