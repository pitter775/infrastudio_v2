import './globals.css'
import Script from 'next/script'
import { conthrax, juraLogo } from '@/lib/fonts'

export const metadata = {
  metadataBase: new URL('https://www.infrastudio.pro'),
  title: 'InfraStudio',
  description:
    'Automacao com IA, WhatsApp inteligente e sistemas sob medida para vender mais sem aumentar a operacao manual.',
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: [{ url: '/logo.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'InfraStudio',
    description:
      'Automacao com IA, WhatsApp inteligente e sistemas sob medida para vender mais sem aumentar a operacao manual.',
    images: [
      {
        url: '/compartilhar.png',
        width: 1200,
        height: 630,
        alt: 'InfraStudio - imagem de compartilhamento',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InfraStudio',
    description:
      'Automacao com IA, WhatsApp inteligente e sistemas sob medida para vender mais sem aumentar a operacao manual.',
    images: ['/compartilhar.png'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`dark ${juraLogo.variable} ${conthrax.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-WFVDDS2QY2" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-WFVDDS2QY2');
          `}
        </Script>
        {children}
      </body>
    </html>
  )
}
