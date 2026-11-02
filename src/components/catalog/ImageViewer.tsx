import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Texto';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALTO_X = 36;

type Props = {
  images: string[];
  visible: boolean;
  initialIndex: number;
  onClose: () => void;
};

/**
 * "Visualizador de imágenes en pantalla completa" del plan (ficha de
 * detalle): logo + fotos de producto se ven en miniatura en la pantalla,
 * pero cualquiera se puede tocar para verla grande, con deslizamiento entre
 * todas las fotos de esa publicación.
 */
export function ImageViewer({ images, visible, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [altoPantalla, setAltoPantalla] = useState(0);
  /** Alto / ancho de cada foto, cuando carga: para saber dónde empieza. */
  const [proporciones, setProporciones] = useState<Record<number, number>>({});

  if (images.length === 0) return null;

  // La X, centrada, a 1/3 del negro que queda sobre la foto: un tercio de
  // espacio arriba y dos tercios abajo. Mientras la foto no carga, o si llena
  // la pantalla de alto, va
  // arriba como antes, siempre bajo la barra de estado.
  const proporcion = proporciones[index];
  const altoFoto = proporcion ? Math.min(altoPantalla, SCREEN_WIDTH * proporcion) : altoPantalla;
  const negroArriba = (altoPantalla - altoFoto) / 2;
  const topeX = Math.max(insets.top + 10, negroArriba / 3 - ALTO_X / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} onLayout={(e) => setAltoPantalla(e.nativeEvent.layout.height)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.slide}>
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                onLoad={(e) => {
                  const { width, height } = e.source;
                  if (width > 0) setProporciones((p) => ({ ...p, [i]: height / width }));
                }}
              />
            </View>
          ))}
        </ScrollView>

        <Pressable onPress={onClose} hitSlop={12} style={[styles.closeButton, { top: topeX }]}>
          <Text style={styles.closeLabel}>✕</Text>
        </Pressable>
        <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
          {images.length > 1 && (
            <Text style={styles.counter}>
              {index + 1} / {images.length}
            </Text>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  closeButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: ALTO_X,
    height: ALTO_X,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    fontFamily: Fonts.medium,
    color: Colors.text,
    fontSize: 16,
  },
  counter: {
    position: 'absolute',
    right: 18,
    fontFamily: Fonts.medium,
    color: Colors.text,
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
