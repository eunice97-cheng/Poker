import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { FloatingButtons } from '@/components/ui/FloatingButtons'
import { LandscapeOnlyGuard } from '@/components/ui/LandscapeOnlyGuard'
import { MainSiteLink } from '@/components/ui/MainSiteLink'
import { AudioProvider } from '@/hooks/useAudio'

export const metadata: Metadata = {
  title: 'Arcana Casino',
  description: 'Arcana Studio Labs casino lobby for Poker and BlackJack Lounge',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "vuweiu6c8h");`}
        </Script>
        <AudioProvider>
          <MainSiteLink />
          {children}
          <LandscapeOnlyGuard />
          <FloatingButtons />
        </AudioProvider>
      </body>
    </html>
  )
}
