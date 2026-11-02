import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { REJILLA, u } from '@/lib/rejilla';

/**
 * Fila de filtros de las listas del panel ("Recientes / Antiguos /
 * Pendientes"), con el mismo estilo de las categorías del inicio: texto
 * plano, la opción elegida en rojo y el resto en blanco.
 */
export function FiltrosOrden<T extends string>({
  opciones,
  elegida,
  onElegir,
  grande,
  sinAireArriba,
}: {
  opciones: { id: T; label: string }[];
  elegida: T;
  onElegir: (id: T) => void;
  /** Letra más grande (los datos de Métricas, como en el diseño). */
  grande?: boolean;
  /** Sin el espacio de arriba: pegada al encabezado (el subtítulo ya deja el suyo). */
  sinAireArriba?: boolean;
}) {
  // Del tamaño de los filtros del "+" (Activas / Espera / Rechazo): si no caben
  // todos, la fila se desliza de lado.
  return (
    // En una sola línea: si aun así no caben, se desliza de lado.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Sin esto, la ScrollView se estira a lo alto y empuja todo hacia abajo.
      style={styles.contenedor}
      contentContainerStyle={[styles.fila, sinAireArriba && styles.filaSinAireArriba]}
      accessibilityRole="tablist">
      {opciones.map((opcion) => {
        const activa = opcion.id === elegida;
        return (
          <Pressable
            key={opcion.id}
            onPress={() => onElegir(opcion.id)}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}>
            <Text style={[styles.label, grande && styles.labelGrande, activa && styles.labelActiva]}>{opcion.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexGrow: 0,
  },
  // La misma separación y sangría que las categorías del inicio: la primera
  // entra a 70 del borde de la pantalla (la pantalla ya aporta 25).
  fila: {
    flexDirection: 'row',
    gap: u(64),
    paddingLeft: u(70 - REJILLA.margenLateral),
    paddingRight: u(REJILLA.margenLateral),
    paddingVertical: Spacing.three,
  },
  filaSinAireArriba: {
    paddingTop: 0,
  },
  label: {
    fontFamily: Fonts.delgada,
    fontSize: 24,
    color: Colors.text,
  },
  labelGrande: {
    fontSize: 26,
  },
  labelActiva: {
    color: Colors.accent,
  },
});
