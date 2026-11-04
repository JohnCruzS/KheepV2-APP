import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

import { MiBanner, fetchMisBanners, pagarConFlow } from '@/lib/catalog';

/**
 * Política de pago de los banners (0060): se pagan al crearlos, pasan por
 * revisión y, si se rechazan, se cambia la imagen y se reenvían con el mismo
 * pago, las veces que haga falta. El pago no se reembolsa.
 */

export const URL_TERMINOS = 'https://johncruzs.github.io/KheepV2-APP/terminos/';

export const AVISO_PAGO_BANNER =
  'Tu banner pasa por revisión antes de mostrarse. Si se rechaza, cambias la imagen y lo reenvías con el mismo pago, ' +
  'las veces que necesites. El pago no se reembolsa.';

/** La versión corta, sobre el botón que cobra. */
export const AVISO_PAGO_BANNER_CORTO =
  'Pasa por revisión. Si se rechaza, lo reenvías con otra imagen y el mismo pago. No se reembolsa.';

/** Pide aceptar la política antes de cobrar. Resuelve true solo si acepta. */
export function aceptarPoliticaDePago(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Antes de pagar',
      AVISO_PAGO_BANNER,
      [
        {
          text: 'Ver términos',
          onPress: () => {
            Linking.openURL(URL_TERMINOS).catch(() => {});
            resolve(false);
          },
        },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Aceptar y pagar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Abre la página de pago de Flow y, al volver, recarga los banners unas veces,
 * porque Flow avisa el pago a la base un momento después. Devuelve la lista
 * actualizada.
 */
export async function pagarYEsperar(ids: string[]): Promise<MiBanner[]> {
  const url = await pagarConFlow(ids);
  await WebBrowser.openAuthSessionAsync(url, 'kheep://banner/mis');
  let lista: MiBanner[] = [];
  for (let i = 0; i < 4; i++) {
    lista = (await fetchMisBanners()).banners;
    if (lista.filter((b) => ids.includes(b.id)).every((b) => b.pagado)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return lista;
}
