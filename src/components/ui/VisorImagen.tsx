import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const ZOOM_MAXIMO = 4;
const ALTO_X = 30;

function distancia(toques: readonly { pageX: number; pageY: number }[]) {
  return Math.hypot(toques[0].pageX - toques[1].pageX, toques[0].pageY - toques[1].pageY);
}

/**
 * Una imagen a pantalla completa, entera (sin recortar). Con dos dedos se
 * agranda y, agrandada, se mueve con uno. Un toque la vuelve a su tamaño o,
 * si ya lo tiene, cierra. Para revisar un banner antes de aprobarlo.
 */
export function VisorImagen({ uri, visible, onCerrar }: { uri: string; visible: boolean; onCerrar: () => void }) {
  const escala = useRef(new Animated.Value(1)).current;
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  // Lo que vale ahora (Animated no lo deja leer) y al empezar el gesto.
  const actual = useRef({ escala: 1, x: 0, y: 0 });
  const inicio = useRef({ escala: 1, x: 0, y: 0, distancia: 0, dosDedos: false, movio: false, cuando: 0 });

  const poner = (e: number, nx: number, ny: number) => {
    actual.current = { escala: e, x: nx, y: ny };
    escala.setValue(e);
    x.setValue(nx);
    y.setValue(ny);
  };

  // El PanResponder se arma una vez: el cierre se lee de acá.
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        inicio.current = { ...actual.current, distancia: 0, dosDedos: false, movio: false, cuando: Date.now() };
      },
      onPanResponderMove: (ev, g) => {
        const toques = ev.nativeEvent.touches;
        if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) inicio.current.movio = true;
        if (toques.length >= 2) {
          // Al poner el segundo dedo se toma la medida de partida.
          if (!inicio.current.dosDedos) {
            inicio.current = { ...inicio.current, ...actual.current, distancia: distancia(toques), dosDedos: true };
            return;
          }
          const e = Math.min(ZOOM_MAXIMO, Math.max(1, (inicio.current.escala * distancia(toques)) / inicio.current.distancia));
          poner(e, actual.current.x, actual.current.y);
        } else if (!inicio.current.dosDedos && actual.current.escala > 1) {
          poner(actual.current.escala, inicio.current.x + g.dx, inicio.current.y + g.dy);
        }
      },
      onPanResponderRelease: () => {
        const toque = !inicio.current.movio && !inicio.current.dosDedos && Date.now() - inicio.current.cuando < 300;
        if (toque) {
          if (actual.current.escala > 1) poner(1, 0, 0);
          else onCerrarRef.current();
          return;
        }
        if (actual.current.escala <= 1) poner(1, 0, 0);
      },
    }),
  ).current;

  // La X, centrada, a 1/3 del negro que queda sobre la imagen (como en el
  // visor de fotos), siempre bajo la barra de estado.
  const insets = useSafeAreaInsets();
  const [pantalla, setPantalla] = useState({ ancho: 0, alto: 0 });
  const [proporcion, setProporcion] = useState(0);
  const altoImagen = proporcion ? Math.min(pantalla.alto, pantalla.ancho * proporcion) : pantalla.alto;
  const topeX = Math.max(insets.top + 10, (pantalla.alto - altoImagen) / 2 / 3 - ALTO_X / 2);

  const cerrar = () => {
    poner(1, 0, 0);
    onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cerrar} onShow={() => poner(1, 0, 0)}>
      <View
        style={styles.fondo}
        {...gesto.panHandlers}
        onLayout={(e) => setPantalla({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}>
        <Animated.View style={[styles.lienzo, { transform: [{ translateX: x }, { translateY: y }, { scale: escala }] }]}>
          <Image
            source={{ uri }}
            style={styles.imagen}
            contentFit="contain"
            onLoad={(e) => e.source.width > 0 && setProporcion(e.source.height / e.source.width)}
          />
        </Animated.View>
      </View>
      <Pressable
        onPress={cerrar}
        hitSlop={16}
        style={[styles.cerrar, { top: topeX }]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar imagen">
        <Ionicons name="close" size={ALTO_X} color={Colors.text} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  lienzo: {
    flex: 1,
  },
  imagen: {
    flex: 1,
  },
  cerrar: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
