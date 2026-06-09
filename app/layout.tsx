import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { APP_DESCRIPTION, APP_DISPLAY_NAME } from '@/lib/branding'
import { DemoAuthProvider } from '@/lib/demo/auth'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const redHatDisplay = localFont({
  src: [
    {
      path: '../public/fonts/RedHatDisplay-VariableFont_wght.ttf',
      weight: '300 900',
      style: 'normal',
    },
  ],
  variable: '--font-red-hat-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-mark-white.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon-mark-colour.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
    ],
    apple: '/pixel-pluz-logo.svg.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${redHatDisplay.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <DemoAuthProvider><AppShell>{children}</AppShell></DemoAuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}