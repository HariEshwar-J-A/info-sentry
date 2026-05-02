import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/shell/Sidebar'

export const metadata: Metadata = {
  title: 'Info-Sentry',
  description: 'Personal AI news intelligence system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
      <body
        style={{
          backgroundColor: '#0a0a0a',
          color: '#f0f0f0',
          margin: 0,
          display: 'flex',
          minHeight: '100vh',
        }}
      >
        <Sidebar />
        <main
          style={{
            flex: 1,
            marginLeft: '240px',
            minHeight: '100vh',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  )
}
