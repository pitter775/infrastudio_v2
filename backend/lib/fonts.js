import localFont from 'next/font/local'

export const juraLogo = localFont({
  src: '../public/fonts/jura-bold.ttf',
  variable: '--font-infrastudio-jura',
  weight: '700',
  style: 'normal',
  display: 'swap',
})

export const conthrax = localFont({
  src: '../public/fonts/conthrax-sb.ttf',
  variable: '--font-infrastudio-conthrax',
  weight: '600',
  style: 'normal',
  display: 'swap',
})
