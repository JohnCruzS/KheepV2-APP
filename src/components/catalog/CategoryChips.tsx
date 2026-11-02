import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Texto';

import { Colors, Fonts } from '@/constants/theme';
import { REJILLA, u } from '@/lib/rejilla';
import type { Categoria } from '@/lib/catalog';

type Props = {
  categorias: Categoria[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Alto de la fila, si no es el del inicio (los filtros del "+" van más bajos). */
  alto?: number;
  /** Las opciones al centro de la pantalla, en vez de arrancar a la izquierda. */
  centrado?: boolean;
};

/**
 * Alto de la fila (185 de 1000, documento EDIT APP). Se usa también para el
 * hueco que se deja mientras las categorías todavía no llegan, así el
 * catálogo no da un salto cuando la lista llega.
 */
const ALTO_FILA = u(REJILLA.categoriasAlto);

/**
 * Fila de categorías como texto plano (sin fondo de "chip"), en Poppins
 * Light como la plantilla: la seleccionada en rojo, el resto en blanco.
 * Arranca más adentro que las tarjetas (sangría de la plantilla).
 */
function CategoryChipsComponent({ categorias, selectedId, onSelect, alto = ALTO_FILA, centrado }: Props) {
  // Mientras se cargan las categorías no se dibuja nada, solo se reserva el
  // alto de la fila. El hueco evita además que el catálogo dé un salto cuando la
  // lista llega.
  if (categorias.length === 0) {
    return <View style={{ height: alto }} />;
  }

  // Centradas (los filtros del "+"): repartidas a lo ancho con el mismo
  // espacio entre todas, y la letra según el ancho de la pantalla, sin
  // agrandarse con la letra grande del sistema: así siempre caben con aire.
  if (centrado) {
    return (
      <View style={styles.repartidas}>
        {categorias.map((categoria) => (
          <Tab
            key={categoria.id}
            label={categoria.nombre}
            active={selectedId === categoria.id}
            alto={alto}
            ajustada
            onPress={() => onSelect(categoria.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {categorias.map((categoria) => (
        <Tab
          key={categoria.id}
          label={categoria.nombre}
          active={selectedId === categoria.id}
          alto={alto}
          onPress={() => onSelect(categoria.id)}
        />
      ))}
    </ScrollView>
  );
}

export const CategoryChips = memo(CategoryChipsComponent);

function Tab({
  label,
  active,
  alto,
  ajustada,
  onPress,
}: {
  label: string;
  active: boolean;
  alto: number;
  ajustada?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text
        style={[styles.label, { lineHeight: alto }, ajustada && styles.labelAjustada, active && styles.labelActive]}
        maxFontSizeMultiplier={ajustada ? 1 : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // En la rejilla de 1000: la primera categoría entra a 70
  // del borde de la pantalla —el contenedor del catálogo ya aporta 25— y
  // entre una y otra hay 64. El texto va centrado en la fila de 185: unos 70
  // arriba y 70 abajo.
  container: {
    gap: u(64),
    paddingLeft: u(70 - REJILLA.margenLateral),
    paddingRight: u(REJILLA.margenLateral),
    alignItems: 'center',
  },
  repartidas: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: u(REJILLA.margenLateral),
  },
  label: {
    fontFamily: Fonts.delgada,
    fontSize: 24,
    color: Colors.text,
  },
  // 24 en una pantalla como la del diseño; más chica en una más angosta.
  labelAjustada: {
    fontSize: u(56),
  },
  labelActive: {
    fontFamily: Fonts.delgada,
    color: Colors.accent,
  },
});
