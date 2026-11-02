import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Texto';
import { TextoDeslizante } from '@/components/ui/TextoDeslizante';
import { VisorImagen } from '@/components/ui/VisorImagen';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { BannerEnRevision } from '@/lib/catalog';
import { abrirEnlaceConAviso, dominioDe, senalesDeRiesgo } from '@/lib/enlaceSeguro';
import { FORMATO_RECORTE, REJILLA, u } from '@/lib/rejilla';

/** Lo que espera un toque a ver si viene el segundo. */
const DOBLE_TOQUE_MS = 400;

/**
 * Un banner por revisar: la imagen tal como se verá en el carrusel. Dos
 * toques en ella lo aprueban y uno la abre en grande,
 * entera y con zoom. Con `conDatos`, debajo va de quién es, dónde se muestra
 * y por cuántos días (en el Aprobar general, donde se mezclan banners de
 * todos).
 *
 * El enlace se revisa sin abrirlo: el sitio destacado y las señales de que
 * puede ser engañoso. Tocarlo pide confirmación.
 */
export function TarjetaBanner({
  banner,
  onDobleToque,
  conDatos,
}: {
  banner: BannerEnRevision;
  onDobleToque: () => void;
  conDatos?: boolean;
}) {
  const ultimoToque = useRef(0);
  const esperaUnToque = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verImagen, setVerImagen] = useState(false);

  const enlace = banner.enlace;
  const senales = enlace ? senalesDeRiesgo(enlace) : [];

  useEffect(() => () => void (esperaUnToque.current && clearTimeout(esperaUnToque.current)), []);

  return (
    <View>
      <Pressable
        onPressIn={() => {
          const ahora = Date.now();
          if (ahora - ultimoToque.current < DOBLE_TOQUE_MS) {
            ultimoToque.current = 0;
            if (esperaUnToque.current) clearTimeout(esperaUnToque.current);
            esperaUnToque.current = null;
            onDobleToque();
          } else {
            ultimoToque.current = ahora;
            esperaUnToque.current = setTimeout(() => {
              esperaUnToque.current = null;
              setVerImagen(true);
            }, DOBLE_TOQUE_MS);
          }
        }}
        accessibilityHint="Un toque la abre en grande; dos toques aprueban el banner">
        <Image source={{ uri: banner.imagen_url }} style={styles.imagen} contentFit="cover" />
      </Pressable>
      <VisorImagen uri={banner.imagen_url} visible={verImagen} onCerrar={() => setVerImagen(false)} />
      {conDatos && (
        <>
          <TextoDeslizante texto={banner.autor?.nombre ?? 'Comerciante'} style={styles.autor} />
          <TextoDeslizante texto={(banner.comuna?.nombre ?? 'Todas las comunas') + (banner.dias ? ` · ${banner.dias} días` : '')} style={styles.dato} />
        </>
      )}
      {enlace ? (
        <Pressable
          onPress={() => abrirEnlaceConAviso(enlace)}
          accessibilityRole="link"
          accessibilityHint="Pide confirmación antes de abrirlo">
          <TextoDeslizante texto={dominioDe(enlace)} style={styles.sitio} onPress={() => abrirEnlaceConAviso(enlace)} />
          <TextoDeslizante texto={enlace} style={styles.dato} onPress={() => abrirEnlaceConAviso(enlace)} />
          {senales.map((s) => (
            <Text key={s} style={styles.aviso}>
              ⚠ {s}
            </Text>
          ))}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  imagen: {
    width: '100%',
    aspectRatio: FORMATO_RECORTE.banner[0] / FORMATO_RECORTE.banner[1],
    borderRadius: u(REJILLA.curvatura),
    backgroundColor: Colors.surface,
  },
  autor: {
    fontFamily: Fonts.medium,
    fontSize: 18,
    color: Colors.text,
    marginTop: Spacing.three,
  },
  dato: {
    fontFamily: Fonts.delgada,
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: Spacing.one,
  },
  sitio: {
    fontFamily: Fonts.medium,
    fontSize: 18,
    color: Colors.text,
    marginTop: Spacing.three,
  },
  aviso: {
    fontFamily: Fonts.delgada,
    fontSize: 15,
    color: Colors.warning,
    marginTop: Spacing.one,
  },
});
