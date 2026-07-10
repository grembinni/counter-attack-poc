/** NationFlag — renders a nation's SVG flag from /flags/{iso}.svg (flagcdn.com downloads).
 * Flag files live in packages/client/public/flags/ and are served at /flags/*.svg by Vite.
 * Unmapped nationalities silently render nothing rather than a broken image.
 */

const NATION_TO_ISO: Readonly<Record<string, string>> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Belgium: 'be',
  Bolivia: 'bo',
  Brazil: 'br',
  Cameroon: 'cm',
  Canada: 'ca',
  Colombia: 'co',
  Croatia: 'hr',
  'Czech Republic': 'cz',
  Denmark: 'dk',
  'El Salvador': 'sv',
  England: 'gb-eng',
  France: 'fr',
  Gabon: 'ga',
  Germany: 'de',
  Ghana: 'gh',
  Honduras: 'hn',
  Ireland: 'ie',
  Italy: 'it',
  'Ivory Coast': 'ci',
  Korea: 'kr',
  Mexico: 'mx',
  Moldova: 'md',
  Montenegro: 'me',
  Netherlands: 'nl',
  Nigeria: 'ng',
  'Northern Ireland': 'gb-nir',
  Norway: 'no',
  Palestine: 'ps',
  Portugal: 'pt',
  Romania: 'ro',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  Serbia: 'rs',
  Slovakia: 'sk',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Turkey: 'tr',
  US: 'us',
  'United States': 'us',
  Uruguay: 'uy',
  Venezuela: 've',
};

export function NationFlag({ nationality, size = 20 }: { nationality: string; size?: number }) {
  const iso = NATION_TO_ISO[nationality];
  if (!iso) return null;

  const h = Math.round(size * 0.67); // ~2:3 flag aspect ratio

  return (
    <img
      src={`/flags/${iso}.svg`}
      alt={nationality}
      title={nationality}
      width={size}
      height={h}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
    />
  );
}
