'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { APP_DISPLAY_NAME, demoEmail } from '@/lib/branding'
import { defaultUsers } from '@/lib/demo/seed'
import { useDemoAuth } from '@/lib/demo/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useDemoAuth()
  const [email, setEmail] = useState(demoEmail('superadmin'))
  const [password, setPassword] = useState('demo123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#153e9066,transparent_35%),radial-gradient(circle_at_bottom_right,#153e9066,transparent_35%)]" />
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-[10%] top-[15%] h-80 w-80 bg-[#153e90] blur-[140px]" />
        <div className="absolute right-[10%] bottom-[15%] h-80 w-80 bg-[#54e346] blur-[150px]" />
      </div>

      <div className="relative z-10 grid w-full max-w-[1050px] grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
        <div className="hidden border border-[#153e90]/35 bg-[#111827]/60 p-8 text-white shadow-[0_0_80px_rgba(21,62,144,0.18)] backdrop-blur-2xl lg:block">
          <Image src="/pixlpluz-white-logo.svg" alt={APP_DISPLAY_NAME} width={170} height={65} priority />
          <h1 className="mt-10 text-4xl font-bold leading-tight">{APP_DISPLAY_NAME} Demo Portal</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70">A client-ready demo with dynamic roles, sidebar permissions, task submissions, HOD review, Final QA, placement, certificates and complaints.</p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {['Super Admin creates roles', 'Branch controller scope', 'mentors upload marks', 'HOD and QA workflow'].map((item) => (
              <div key={item} className="border border-white/10 bg-white/5 p-4 text-sm font-semibold">{item}</div>
            ))}
          </div>
        </div>

        <div className="border border-[#153e90]/35 bg-[#111827]/80 p-6 text-white shadow-[0_0_80px_rgba(21,62,144,0.18)] backdrop-blur-2xl sm:p-8">
          <Image src="/pixlpluz-white-logo.svg" alt={APP_DISPLAY_NAME} width={150} height={55} priority className="mb-8 lg:hidden" />
          <p className="mb-2 text-sm font-semibold text-[#54e346]">Frontend demo only</p>
          <h2 className="text-3xl font-bold">Login to Portal</h2>
          <p className="mt-3 text-sm text-white/60">Use any demo account below. Password is demo123.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#153e90]" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/70">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-white/10 bg-white/10 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/30 focus:border-[#153e90]" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {error && <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-[#153e90] px-4 py-3 font-semibold text-white transition hover:bg-[#1d4fb3] disabled:opacity-60">{loading ? 'Logging in...' : 'Login to Portal'}</button>
          </form>

          <div className="mt-6 grid max-h-64 gap-2 overflow-y-auto pr-1">
            {defaultUsers.map((u) => (
              <button key={u.id} type="button" onClick={() => { setEmail(u.email); setPassword('demo123') }} className="border border-white/10 bg-white/5 px-3 py-2 text-left text-xs hover:bg-white/10">
                <span className="block font-semibold text-white">{u.fullName}</span>
                <span className="text-white/55">{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
