import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { EditorPantalla } from '@/components/admin/EditorPantalla';
import { FotoRemota } from '@/components/ui/FotoRemota';
import { Text } from '@/components/ui/Texto';
import { TextoDeslizante } from '@/components/ui/TextoDeslizante';
import { Colors, Fonts } from '@/constants/theme';
import { PickedImage, pickAndCompressImage } from '@/lib/images';
import { REJILLA, u } from '@/lib/rejilla';

export type ProductoBorrador = {
  nombre: string;
  precio: string;
  /** Foto nueva elegida de la galería. */
  image: PickedImage | null;
  /** Al editar: el producto que ya existe y su foto subida. */
  id?: string | null;
  imagenUrl?: string | null;
};
export const PRODUCTO_VACIO: ProductoBorrador = { nombre: '', precio: '', image: null };

/** Topes: 100 caracteres de nombre y precio hasta $99.999.999. */
const MAX_NOMBRE = 100;
const MAX_DIGITOS_PRECIO = 8;
/** Una publicación es un solo producto: se publican de a una. */
const MAX_PRODUCTOS = 1;

const tieneAlgo = (p: ProductoBorrador) =>
  !!p.image || !!p.imagenUrl || p.nombre.trim().length > 0 || p.precio.length > 0;

/**
 * La publicación que se está creando, con la forma exacta de la tarjeta del
 * inicio: lo que se ve es lo que se va a publicar.
 *
 *  - La foto y el nombre son los del perfil (no se tocan acá).
 *  - Tocar la foto del producto la elige (con el recorte de la tarjeta);
 *    mantenerla apretada quita ese producto.
 *  - Tocar el nombre o el precio abre el editor para escribirlo.
 *  - Un solo producto por publicación: cada una se
 *    publica aparte. Las antiguas con varios se siguen pasando deslizando.
 */
export function TarjetaEditable({
  logoUrl,
  titulo,
  productos,
  onCambiar,
  onTocar,
}: {
  logoUrl: string | null;
  titulo: string;
  productos: ProductoBorrador[];
  onCambiar: (productos: ProductoBorrador[]) => void;
  /** Solo de muestra: cualquier toque hace esto (por ejemplo, ir a publicar). */
  onTocar?: () => void;
}) {
  const [ancho, setAncho] = useState(0);
  const [indice, setIndice] = useState(0);
  const [editando, setEditando] = useState<'nombre' | 'precio' | null>(null);

  // Una página vacía al final para agregar otro (si el último ya tiene algo).
  const paginas =
    productos.length < MAX_PRODUCTOS && tieneAlgo(productos[productos.length - 1]) ? [...productos, PRODUCTO_VACIO] : productos;
  const actual = paginas[Math.min(indice, paginas.length - 1)] ?? PRODUCTO_VACIO;

  function cambiar(i: number, cambio: Partial<ProductoBorrador>) {
    const lista = i >= productos.length ? [...productos, { ...PRODUCTO_VACIO, ...cambio }] : productos.map((p, j) => (j === i ? { ...p, ...cambio } : p));
    onCambiar(lista);
  }

  async function elegirFoto(i: number) {
    try {
      const image = await pickAndCompressImage({ uso: 'producto' });
      if (image) cambiar(i, { image });
    } catch {
      // Sin galería, se queda como estaba.
    }
  }

  function quitar(i: number) {
    if (i >= productos.length || !tieneAlgo(productos[i])) return;
    Alert.alert('¿Quitar este producto?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          const resto = productos.filter((_, j) => j !== i);
          onCambiar(resto.length > 0 ? resto : [PRODUCTO_VACIO]);
          setIndice((x) => Math.max(0, Math.min(x, resto.length - 1)));
        },
      },
    ]);
  }

  function alDeslizar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (ancho > 0) setIndice(Math.round(e.nativeEvent.contentOffset.x / ancho));
  }

  const precio = Number(actual.precio) || 0;

  return (
    <View style={styles.row}>
      <View style={styles.iconPanel}>
        {logoUrl ? (
          <FotoRemota uri={logoUrl} ancho={58} style={styles.fotoPerfil} />
        ) : (
          <View style={[styles.fotoPerfil, styles.fotoPerfilVacia]} />
        )}
        <View style={styles.iconShadow} />
      </View>

      <View style={styles.contentPanel} onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={alDeslizar}
          style={StyleSheet.absoluteFill}>
          {paginas.map((p, i) => (
            <Pressable
              key={i}
              style={[styles.pagina, { width: ancho }]}
              onPress={onTocar ?? (() => elegirFoto(i))}
              onLongPress={onTocar ? undefined : () => quitar(i)}
              delayLongPress={400}
              accessibilityRole="imagebutton"
              accessibilityLabel={p.image || p.imagenUrl ? 'Cambiar foto del producto' : 'Subir foto del producto'}>
              {p.image ? (
                <Image source={{ uri: p.image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : p.imagenUrl ? (
                <FotoRemota uri={p.imagenUrl} ancho={ancho || 300} style={StyleSheet.absoluteFill} />
              ) : (
                <View style={styles.sinFoto}>
                  <Text style={styles.sinFotoTexto}>{i === 0 ? 'Toca para subir la foto' : '+ Otro producto'}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.velo} pointerEvents="none" />

        <View style={styles.textos} pointerEvents="box-none">
          <TextoDeslizante texto={titulo} style={styles.title} />

          <View style={styles.bottomRow} pointerEvents="box-none">
            <Pressable style={styles.zonaNombre} onPress={onTocar ?? (() => setEditando('nombre'))} hitSlop={16} accessibilityRole="button">
              <TextoDeslizante texto={actual.nombre || 'Producto'} style={[styles.productName, !actual.nombre && styles.vacio]} onPress={onTocar ?? (() => setEditando('nombre'))} />
            </Pressable>
            <Pressable onPress={onTocar ?? (() => setEditando('precio'))} hitSlop={16} accessibilityRole="button">
              <Text style={[styles.price, !precio && styles.vacio]}>
                {precio ? `$ ${precio.toLocaleString('es-CL')}` : 'Precio'}
              </Text>
            </Pressable>
          </View>
        </View>

      </View>

      <EditorPantalla
        visible={editando === 'nombre'}
        subtitulo="Producto"
        placeholder="Producto"
        inicial={actual.nombre}
        propsCampo={{ autoCapitalize: 'sentences', maxLength: MAX_NOMBRE }}
        validar={() => null}
        onCerrar={() => setEditando(null)}
        onGuardar={async (v) => cambiar(indice, { nombre: v.trim().slice(0, MAX_NOMBRE) })}
      />
      <EditorPantalla
        visible={editando === 'precio'}
        subtitulo="Precio"
        placeholder="Precio"
        inicial={actual.precio}
        propsCampo={{ keyboardType: 'number-pad', maxLength: MAX_DIGITOS_PRECIO }}
        validar={() => null}
        onCerrar={() => setEditando(null)}
        onGuardar={async (v) => cambiar(indice, { precio: v.replace(/\D/g, '').slice(0, MAX_DIGITOS_PRECIO) })}
      />
    </View>
  );
}

/** Sombra de los textos sobre la foto, igual que en la tarjeta del inicio. */
const SOMBRA = {
  textShadowColor: 'rgba(0,0,0,0.85)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

// Las mismas medidas que PublicacionCard.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: u(REJILLA.galeriaAlto),
    borderRadius: u(REJILLA.curvatura),
    overflow: 'hidden',
    backgroundColor: '#0D0D0D',
  },
  iconPanel: {
    width: '23%',
    backgroundColor: Colors.card,
    alignItems: 'center',
    paddingTop: 10,
  },
  fotoPerfil: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  fotoPerfilVacia: {
    backgroundColor: '#E4E4E4',
  },
  iconShadow: {
    width: 46,
    height: 12,
    marginTop: 6,
    experimental_backgroundImage: 'radial-gradient(ellipse closest-side, rgba(0,0,0,0.30), rgba(0,0,0,0))',
  },
  contentPanel: {
    flex: 1,
    overflow: 'hidden',
  },
  pagina: {
    height: '100%',
  },
  sinFoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3C3C3C',
  },
  sinFotoTexto: {
    fontFamily: Fonts.delgada,
    fontSize: 15,
    color: '#BDBDBD',
  },
  velo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  textos: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    // El centro de la línea del nombre, a la altura del centro de la foto del
    // perfil (10 + 58 / 2 = 39): 39 - 32 / 2.
    paddingTop: 23,
    // El mismo margen a los dos lados: el precio queda
    // tan adentro como el producto.
    paddingLeft: 19,
    paddingRight: 19,
    paddingBottom: 14,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
    ...SOMBRA,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zonaNombre: {
    flexShrink: 1,
    paddingVertical: 4,
  },
  productName: {
    fontFamily: Fonts.delgada,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    ...SOMBRA,
  },
  price: {
    marginLeft: 8,
    paddingVertical: 4,
    fontFamily: Fonts.light,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    ...SOMBRA,
  },
  // Sin escribir: el hueco con su nombre, más tenue.
  vacio: {
    opacity: 0.6,
  },
});
