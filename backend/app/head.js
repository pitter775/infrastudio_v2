const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'InfraStudio',
  image: 'https://www.infrastudio.pro/logo.png',
  url: 'https://www.infrastudio.pro',
  telephone: '+55 11 94950-6267',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Estrada de S\u00e3o Francisco',
    addressLocality: 'Tabo\u00e3o da Serra',
    addressRegion: 'SP',
    addressCountry: 'BR',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
    opens: '00:00',
    closes: '23:59',
  },
}

export default function Head() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
    />
  )
}
