import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar }   from '@/components/shell/Sidebar'
import { BottomNav } from '@/components/shell/BottomNav'
import { ServiceWorkerRegistration } from '@/components/shell/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Info-Sentry',
  description: 'Personal AI news intelligence system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Info-Sentry',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{ backgroundColor: '#0a0a0a', color: '#f0f0f0', margin: 0, display: 'flex', minHeight: '100vh' }}>
        <ServiceWorkerRegistration />
        <Sidebar />
        <main className="layout-main">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
