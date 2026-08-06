'use client'

import { Suspense, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { APP_DISPLAY_NAME } from '@/lib/branding'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Reset link is missing or invalid.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password and confirm password do not match.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })

      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string }

      if (!response.ok || data.ok === false) {
        setError(data.error || 'Could not update password.')
        return
      }

      setMessage(data.message || 'Password updated successfully.')
      setTimeout(() => {
        router.push('/login')
      }, 1200)
    } catch {
      setError('Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md border border-[#153e90]/35 bg-[#111827]/80 p-6 text-white shadow-[0_0_80px_rgba(21,62,144,0.18)] backdrop-blur-2xl sm:p-8">
      <Image
        src="/pixlpluz-white-logo.svg"
        alt={APP_DISPLAY_NAME}
        width={150}
        height={55}
        priority
        className="mb-8"
      />
      <h1 className="text-3xl font-bold">Set new password</h1>
      <p className="mt-3 text-sm text-white/60">Choose a new password for your academy account.</p>

      {!token ? (
        <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          This reset link is invalid. Please request a new one from the forgot password page.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-white/10 bg-white/10 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/30 focus:border-[#153e90]"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#153e90]"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {message && (
            <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#153e90] px-4 py-3 font-semibold text-white transition hover:bg-[#1d4fb3] disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-white/60">
        <Link href="/login" className="text-[#6ee75a] hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#153e9066,transparent_35%),radial-gradient(circle_at_bottom_right,#153e9066,transparent_35%)]" />
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-[10%] top-[15%] h-80 w-80 bg-[#153e90] blur-[140px]" />
        <div className="absolute right-[10%] bottom-[15%] h-80 w-80 bg-[#54e346] blur-[150px]" />
      </div>

      <Suspense
        fallback={
          <div className="relative z-10 w-full max-w-md border border-[#153e90]/35 bg-[#111827]/80 p-6 text-white">
            Loading...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
