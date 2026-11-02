import { Alert, Linking } from 'react-native';

import { logWhatsappClic } from '@/lib/catalog';

/**
 * Abre WhatsApp con un mensaje precargado hacia el teléfono del comercio, y
 * registra la métrica de conversión. El teléfono ya viene validado en
 * formato +569XXXXXXXX por un constraint de la base de datos (migración
 * 0007), así que aquí solo se le quita el "+" para armar el enlace.
 *
 * Dos reglas para que el toque nunca quede sin hacer nada, en silencio:
 *
 *  - La métrica va aparte y sin `await`: si esa consulta falla (sin señal,
 *    por ejemplo), WhatsApp se abre igual. Contactar es lo importante; si la
 *    métrica se pierde, se pierde.
 *  - No se pregunta con `canOpenURL`: en varios Android devuelve "no" aunque
 *    el enlace sí se pueda abrir. Se intenta abrir directamente, primero la
 *    app de WhatsApp y si no, su página, y solo si ambas fallan se avisa.
 */
/** Abre un chat de WhatsApp con ese número, sin mensaje ni métrica (desde el panel). */
export async function escribirPorWhatsApp(telefono: string) {
  const numero = telefono.replace(/[^\d]/g, '');
  for (const enlace of [`whatsapp://send?phone=${numero}`, `https://wa.me/${numero}`]) {
    try {
      await Linking.openURL(enlace);
      return;
    } catch {
      // Se prueba con el siguiente.
    }
  }
  Alert.alert('No se pudo abrir WhatsApp', `Escríbele al ${telefono}.`);
}

export async function contactarPorWhatsApp(publicacionId: string, telefono: string, titulo: string) {
  // En segundo plano: que un problema con la métrica no impida el contacto.
  void logWhatsappClic(publicacionId).catch(() => {});

  const numero = telefono.replace(/[^\d]/g, '');
  const mensaje = encodeURIComponent(`Hola! Vi "${titulo}" en Kheep y quería consultar 🙂`);
  const enlaces = [`whatsapp://send?phone=${numero}&text=${mensaje}`, `https://wa.me/${numero}?text=${mensaje}`];

  for (const enlace of enlaces) {
    try {
      await Linking.openURL(enlace);
      return;
    } catch {
      // Se prueba con el siguiente.
    }
  }

  Alert.alert(
    'No se pudo abrir WhatsApp',
    `Escríbele al ${telefono}. Si no tienes WhatsApp instalado, puedes instalarlo y volver a intentar.`,
  );
}
