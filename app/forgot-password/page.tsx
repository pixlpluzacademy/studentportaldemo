'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { APP_DISPLAY_NAME } from '@/lib/branding'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string }

      if (!response.ok || data.ok === false) {
        setError(data.error || 'Could not send reset email.')
        return
      }

      setMessage(data.message || 'If that email exists, a reset link has been sent.')
    } catch {
      setError('Could not send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#153e9066,transparent_35%),radial-gradient(circle_at_bottom_right,#153e9066,transparent_35%)]" />
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-[10%] top-[15%] h-80 w-80 bg-[#153e90] blur-[140px]" />
        <div className="absolute right-[10%] bottom-[15%] h-80 w-80 bg-[#54e346] blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-md border border-[#153e90]/35 bg-[#111827]/80 p-6 text-white shadow-[0_0_80px_rgba(21,62,144,0.18)] backdrop-blur-2xl sm:p-8">
        <Image
          src="/pixlpluz-white-logo.svg"
          alt={APP_DISPLAY_NAME}
          width={150}
          height={55}
          priority
          className="mb-8"
        />
        <h1 className="text-3xl font-bold">Forgot password</h1>
        <p className="mt-3 text-sm text-white/60">
          Enter your account email. If it exists, we will send a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#153e90]"
              required
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
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">
          <Link href="/login" className="text-[#6ee75a] hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  )
}
