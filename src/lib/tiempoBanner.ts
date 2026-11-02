import { ahoraServidor } from '@/lib/relojServidor';

/**
 * El tiempo de un banner, para Banners del admin y "Mis banners" del
 * comerciante (las dos vistas lo muestran igual).
 */
type ConTiempo = {
  fecha_inicio?: string | null;
  fecha_fin: string | null;
  pausado_en?: string | null;
  dias?: number | null;
  horas?: number | null;
};

const HORA = 3600000;
const DIA = 24 * HORA;

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * Cuánto del tiempo contratado ya pasó (0 a 1), para la línea de avance
 * estilo video. En pausa queda quieta.
 */
export function progresoBanner(banner: ConTiempo): number {
  if (!banner.fecha_fin) return 0;
  const fin = new Date(banner.fecha_fin).getTime();
  const inicio = banner.fecha_inicio ? new Date(banner.fecha_inicio).getTime() : null;
  const ahora = banner.pausado_en ? new Date(banner.pausado_en).getTime() : ahoraServidor();
  const contratado = banner.horas
    ? banner.horas * HORA
    : banner.dias
      ? banner.dias * DIA
      : inicio !== null
        ? fin - inicio
        : null;
  if (!contratado) return 0;
  return Math.max(0, Math.min(1, (contratado - Math.max(0, fin - ahora)) / contratado));
}

/** "3  10 : 20 : 16": días y, después, horas, minutos y segundos. */
function restante(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  return `${d}  ${dos(Math.floor((s % 86400) / 3600))} : ${dos(Math.floor((s % 3600) / 60))} : ${dos(s % 60)}`;
}

const dias = (n: number) => `${n} ${n === 1 ? 'Día' : 'Días'}`;

/**
 * El tiempo del banner, con los formatos del diseño (se pasa
 * de uno a otro tocándolo):
 *  - restante: cuánto le queda, "3  10 : 20 : 16" (días, horas, minutos y
 *    segundos);
 *  - avance, si se contrató por horas (el admin): "24 : 21 / 48 : 00"
 *    (horas y minutos que lleva, de las horas contratadas);
 *  - avance, si se contrató por días (los comerciantes): "2 Días / 4 Días".
 *
 * El avance se cuenta como lo contratado menos lo que le queda: así no suma
 * el tiempo que estuvo en pausa (al reanudar, el término se corre lo que duró
 * la pausa).
 */
export function tiempoBanner(banner: ConTiempo, verRestante: boolean): string {
  if (!banner.fecha_fin) return 'Sin vencimiento';
  const fin = new Date(banner.fecha_fin).getTime();
  const inicio = banner.fecha_inicio ? new Date(banner.fecha_inicio).getTime() : null;
  // En pausa, el reloj queda detenido en el momento en que se pausó.
  const ahora = banner.pausado_en ? new Date(banner.pausado_en).getTime() : ahoraServidor();
  if (fin <= ahora) return 'Terminado';
  const queda = fin - ahora;

  // Lo contratado: las horas o los días; sin ese dato (banners antiguos), lo
  // que va de la fecha de inicio a la de término.
  const contratado = banner.horas
    ? banner.horas * HORA
    : banner.dias
      ? banner.dias * DIA
      : inicio !== null
        ? fin - inicio
        : null;
  if (verRestante || contratado === null) return restante(queda);

  const llevado = Math.min(contratado, Math.max(0, contratado - queda));
  if (banner.horas) {
    const minutos = Math.floor(llevado / 60000);
    return `${dos(Math.floor(minutos / 60))} : ${dos(minutos % 60)} / ${dos(banner.horas)} : 00`;
  }
  return `${dias(Math.floor(llevado / DIA))} / ${dias(Math.round(contratado / DIA))}`;
}


/** "https://www.kheep.cl/" pasa a "www.kheep.cl": el enlace como se lee. */
export function enlaceCorto(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
