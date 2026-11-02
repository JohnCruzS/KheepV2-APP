/**
 * La hora del servidor, para los contadores de los banners.
 *
 * El reloj del teléfono puede ir unos segundos adelantado o atrasado. Los
 * tiempos de los banners (término, pausa) los marca el servidor con el suyo,
 * así que contarlos con el del teléfono hacía saltar el contador al pausar:
 * primero se congelaba con la hora del teléfono y, al llegar la del
 * servidor, saltaba la diferencia.
 *
 * Se le pregunta la hora al servidor una vez (el encabezado `Date` de una
 * respuesta cualquiera, sin migración) y desde ahí se corrige el teléfono.
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Cuánto hay que sumarle al reloj del teléfono para tener el del servidor. */
let desfase = 0;
let pidiendo: Promise<void> | null = null;

/** La hora del servidor, en milisegundos (como `Date.now()`). */
export function ahoraServidor(): number {
  return Date.now() + desfase;
}

/**
 * Mide el desfase (una vez por sesión de la app). El encabezado `Date` viene
 * en segundos enteros: cada muestra dice que el desfase está dentro de un
 * segundo; con tres muestras se cruzan esos tramos y se toma el medio de lo
 * que queda, para quedar bien por debajo del segundo.
 */
export function sincronizarReloj(): Promise<void> {
  if (!pidiendo) {
    pidiendo = (async () => {
      if (!URL || !CLAVE) return;
      let desde = -Infinity;
      let hasta = Infinity;
      for (let i = 0; i < 3; i++) {
        const salida = Date.now();
        const r = await fetch(`${URL}/rest/v1/`, { method: 'HEAD', headers: { apikey: CLAVE } });
        const llegada = Date.now();
        const segundo = new Date(r.headers.get('date') ?? '').getTime();
        if (Number.isNaN(segundo)) continue;
        // El servidor respondió entre `salida` y `llegada`, cuando su reloj
        // marcaba entre `segundo` y `segundo + 1000`.
        desde = Math.max(desde, segundo - llegada);
        hasta = Math.min(hasta, segundo + 1000 - salida);
      }
      if (desde === -Infinity) return;
      desfase = desde <= hasta ? (desde + hasta) / 2 : desde;
    })().catch(() => {
      // Sin respuesta se sigue con el reloj del teléfono, y se reintenta la próxima vez.
      pidiendo = null;
    });
  }
  return pidiendo;
}
