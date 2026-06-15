import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Sidebar }   from '@/components/shell/Sidebar'
import { BottomNav } from '@/components/shell/BottomNav'

export const metadata: Metadata = {
  title: 'Info-Sentry',
  description: 'Personal AI news intelligence system',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevent accidental zoom-to-text on form focus
  userScalable: false,
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: '#0a0a0a', color: '#f0f0f0', margin: 0, display: 'flex', minHeight: '100vh' }}>
        {isAuthenticated && <Sidebar />}
        <main className={isAuthenticated ? 'layout-main' : undefined} style={isAuthenticated ? undefined : { width: '100%' }}>
          {children}
        </main>
        {isAuthenticated && <BottomNav />}
      </body>
    </html>
  )
}
