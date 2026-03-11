import type { Metadata } from 'next'
import './globals.css'
import { FloatingButtons } from '@/components/ui/FloatingButtons'
import { AudioProvider } from '@/hooks/useAudio'

export const metadata: Metadata = {
  title: 'ASL Basement Poker',
  description: 'Multiplayer Texas Hold\'em Poker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          {children}
          <FloatingButtons />
        </AudioProvider>
      </body>
    </html>
  )
}
