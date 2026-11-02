import { Alert, Linking } from 'react-native';

/**
 * Para revisar el enlace de un banner antes de aprobarlo sin tener que
 * abrirlo: a qué sitio lleva y las señales de que puede ser engañoso.
 * Abrirlo pide confirmación.
 */

/** Acortadores: esconden a dónde lleva el enlace de verdad. */
const ACORTADORES = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'ow.ly', 'rebrand.ly',
  'shorturl.at', 'tiny.cc', 'rb.gy', 's.id', 'buff.ly', 'v.gd', 'lnkd.in', 'shorte.st', 'adf.ly',
];

/** Terminaciones baratas que se usan mucho para estafas. */
const TERMINACIONES_RARAS = ['zip', 'mov', 'xyz', 'top', 'click', 'country', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'loan', 'rest', 'cam'];

/** Archivos que se descargan o instalan solos al abrir el enlace. */
const DESCARGAS = /\.(apk|exe|scr|bat|cmd|msi|dmg|jar|vbs|ps1|zip|rar|7z)(\?|#|$)/i;

function analizar(url: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }
}

/** "https://www.tienda.cl/ofertas" pasa a "tienda.cl": el sitio, que es lo que importa. */
export function dominioDe(url: string): string {
  const u = analizar(url);
  return u ? u.hostname.replace(/^www\./i, '').toLowerCase() : url;
}

/** Lo que hace sospechar de un enlace, en palabras simples. Vacío = nada raro. */
export function senalesDeRiesgo(url: string): string[] {
  const u = analizar(url);
  if (!u) return ['No es una dirección web válida'];
  const host = u.hostname.toLowerCase();
  const senales: string[] = [];
  if (u.protocol !== 'https:') senales.push('No es una conexión segura (sin https)');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) senales.push('Usa números en vez de un nombre de sitio');
  if (host.split('.').some((parte) => parte.startsWith('xn--'))) senales.push('Usa letras que imitan a otras (posible imitación)');
  if (ACORTADORES.some((a) => host === a || host.endsWith(`.${a}`))) senales.push('Es un acortador: no se ve a dónde lleva');
  if (u.username || u.password) senales.push('Tiene un "@" que esconde el sitio real');
  if (TERMINACIONES_RARAS.includes(host.split('.').pop() ?? '')) senales.push('Termina en una extensión muy usada en estafas');
  if (DESCARGAS.test(u.pathname)) senales.push('Descarga un archivo o una aplicación');
  if (u.port) senales.push('Usa un puerto poco común');
  if (host.split('.').length > 4) senales.push('Tiene demasiadas partes en el nombre');
  return senales;
}

/** Abre el enlace después de avisar a qué sitio se va (y por qué podría ser riesgoso). */
export function abrirEnlaceConAviso(url: string) {
  const u = analizar(url);
  if (!u) return Alert.alert('Enlace no válido', 'No es una dirección web que se pueda abrir.');
  const senales = senalesDeRiesgo(url);
  const sitio = dominioDe(url);
  const mensaje =
    `Se abrirá ${sitio} en el navegador.` +
    (senales.length ? `\n\nOjo:\n· ${senales.join('\n· ')}` : '') +
    '\n\nNo escribas claves ni datos, ni descargues nada.';
  Alert.alert('Vas a salir de Kheep', mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Abrir',
      onPress: () => Linking.openURL(u.toString()).catch(() => Alert.alert('No se pudo abrir el enlace', 'Revisa que esté bien escrito.')),
    },
  ]);
}
