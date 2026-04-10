import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
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
        url: '/compartilhar_novo.png',
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
    images: ['/compartilhar_novo.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
