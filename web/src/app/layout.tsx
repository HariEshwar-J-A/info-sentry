import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Sidebar }                from '@/components/shell/Sidebar'
import { BottomNav }             from '@/components/shell/BottomNav'
import { SkipLink }              from '@/components/a11y/SkipLink'
import { PageTransitionWrapper } from '@/components/shell/PageTransitionWrapper'

export const metadata: Metadata = {
  title: 'infoSentry',
  description: 'Intelligence, innovation, insight — a Harieshwar J A initiative',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // WCAG 1.4.4 — do NOT disable user zoom; removed userScalable: false
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const isAuthenticated = !!store.get('is_auth')?.value

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)', margin: 0, display: 'flex', minHeight: '100vh' }}>
        <SkipLink />
        {isAuthenticated && <Sidebar />}
        <main
          id="main"
          className={isAuthenticated ? 'layout-main' : undefined}
          style={isAuthenticated ? undefined : { width: '100%' }}
        >
          <PageTransitionWrapper>{children}</PageTransitionWrapper>
        </main>
        {isAuthenticated && <BottomNav />}
      </body>
    </html>
  )
}
