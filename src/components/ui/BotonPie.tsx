import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing, TarjetaLista } from '@/constants/theme';
import { REJILLA, u } from '@/lib/rejilla';

/** Alto del botón rojo de abajo. */
const ALTO_BOTON = 72;
/** Espacio debajo del botón cuando lleva "Cancelar" (u otro texto) ahí. */
const ALTO_DEBAJO = ALTO_BOTON;
/**
 * Sin nada debajo, el botón baja y queda a tres márgenes laterales del borde,
 *igual en todas las vistas.
 */
const ALTO_DEBAJO_SOLO = u(REJILLA.margenLateral) * 3;

/**
 * El botón rojo de abajo de las vistas ("Guardar", "Nuevo", "Nueva",
 * "Publicar", "Listo"…): mismo tamaño y misma altura en todas, siempre debajo
 * del contenido, nunca encima. Va como último hijo
 * de una pantalla con el borde inferior seguro (SafeAreaView con 'bottom').
 */
export function BotonPie({
  label,
  onPress,
  cargando,
  apagado,
  aviso,
  debajo,
  claro,
  sinEspacioDebajo,
  justoSobreBarra,
  flecha,
}: {
  label: string;
  /** Si devuelve una promesa (publicar, guardar…), el botón no responde hasta que termine. */
  onPress: () => void | Promise<unknown>;
  cargando?: boolean;
  /** Gris y sin responder (por ejemplo, sin cambios que guardar). */
  apagado?: boolean;
  /** Un error, justo encima del botón, sin moverlo. */
  aviso?: string | null;
  /** Texto rojo debajo del botón, como "Cancelar". */
  debajo?: { texto: string; onPress: () => void };
  /** Del color del fondo con texto negro (por ejemplo, "Mi perfil"), en vez de rojo. */
  claro?: boolean;
  /** Sin el espacio de abajo (cuando va arriba de la pantalla). */
  sinEspacioDebajo?: boolean;
  /** En una pestaña: justo sobre la barra de abajo, con un margen chico. */
  justoSobreBarra?: boolean;
  /** Una flecha a la derecha (">"): el botón lleva al paso siguiente, como pagar. */
  flecha?: boolean;
}) {
  // Varios toques seguidos subían la misma publicación varias veces: el
  // "cargando" llega un instante tarde. Mientras la acción sigue en curso (y
  // medio segundo más, para lo que solo cambia de pantalla), se ignoran.
  const enCurso = useRef(false);
  function alTocar() {
    if (enCurso.current) return;
    enCurso.current = true;
    Promise.resolve()
      .then(onPress)
      .catch(() => {})
      .finally(() => setTimeout(() => (enCurso.current = false), 500));
  }

  return (
    <View style={styles.pie}>
      {aviso ? (
        <Text style={styles.aviso} numberOfLines={3}>
          {aviso}
        </Text>
      ) : null}
      <Pressable
        style={({ pressed }) => [
          styles.boton,
          claro && styles.claro,
          apagado && styles.apagado,
          pressed && !apagado && (claro ? styles.claroPresionado : styles.presionado),
        ]}
        onPress={alTocar}
        disabled={apagado || cargando}
        accessibilityRole="button"
        accessibilityLabel={label}>
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.label, claro && styles.labelClaro]} numberOfLines={1}>
            {label}
          </Text>
        )}
        {flecha && !cargando ? (
          <View style={styles.flecha} pointerEvents="none">
            <Ionicons name="chevron-forward" size={30} color={claro ? '#000000' : '#FFFFFF'} />
          </View>
        ) : null}
      </Pressable>
      <View
        style={sinEspacioDebajo ? null : justoSobreBarra ? styles.debajoChico : debajo ? styles.debajo : styles.debajoSolo}>
        {debajo ? (
          <Pressable onPress={debajo.onPress} hitSlop={10} accessibilityRole="button">
            <Text style={styles.debajoTexto}>{debajo.texto}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pie: {
    paddingHorizontal: u(REJILLA.margenLateral),
    paddingTop: Spacing.three,
  },
  aviso: {
    position: 'absolute',
    bottom: '100%',
    left: u(REJILLA.margenLateral),
    right: u(REJILLA.margenLateral),
    fontFamily: Fonts.delgada,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
  },
  boton: {
    height: ALTO_BOTON,
    borderRadius: u(REJILLA.curvatura),
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  // Del mismo color que el fondo gris claro, solo el texto.
  claro: {
    backgroundColor: Colors.backgroundSoft,
  },
  claroPresionado: {
    backgroundColor: '#E4E4E4',
  },
  labelClaro: {
    color: '#000000',
  },
  apagado: {
    backgroundColor: '#7F7F7F',
  },
  presionado: {
    backgroundColor: Colors.accentPressed,
  },
  // Poppins Medium, blanco sobre el rojo.
  label: {
    fontFamily: Fonts.medium,
    fontSize: 26,
    color: '#FFFFFF',
  },
  debajo: {
    height: ALTO_DEBAJO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A la derecha, a un margen lateral del borde; el texto sigue al centro.
  // Tan adentro como el contenido de las tarjetas de lista (los
  // interruptores de las regiones quedan justo encima), no pegada al borde.
  flecha: {
    position: 'absolute',
    right: TarjetaLista.sangria,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  debajoSolo: {
    height: ALTO_DEBAJO_SOLO,
  },
  debajoChico: {
    height: u(REJILLA.margenLateral),
  },
  // "Cancelar" en Poppins Light rojo, como "Salir".
  debajoTexto: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.accent,
  },
});
