import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRODUCTO_VACIO, ProductoBorrador, TarjetaEditable } from '@/components/catalog/TarjetaEditable';
import { BotonPie } from '@/components/ui/BotonPie';
import { EncabezadoMarca } from '@/components/ui/EncabezadoMarca';
import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { crearPublicacion } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/errors';
import { uploadCompressedImage } from '@/lib/images';
import { REJILLA, u } from '@/lib/rejilla';
import { AVISO_SIN_PERMISO, sinPermisoDeEditar, useSession } from '@/providers/SessionProvider';

/** Medidas del diseño (rejilla de 1000, desde arriba): lo negro hasta 1000, la tarjeta en 890. */
const NEGRO = 1000;
const INICIO_TARJETA = 890;

/**
 * Crear una publicación (se llega con "Publicar" desde Publicaciones): la
 * tarjeta tal como se verá en el inicio, que se arma tocando sus partes —la
 * foto, el nombre y el precio del producto—. La foto y el nombre del comercio
 * son los del perfil, y se publica en la comuna y categoría del perfil.
 */
export default function NuevaPublicacionScreen() {
  const router = useRouter();
  const { profile } = useSession();
  // Sin "Editar" no publica ni cambia nada (0057): se avisa y se vuelve.
  const sinPermiso = sinPermisoDeEditar(profile);
  useEffect(() => {
    if (!sinPermiso) return;
    Alert.alert('Sin permiso', AVISO_SIN_PERMISO);
    router.back();
  }, [sinPermiso, router]);
  const [borrador, setBorrador] = useState<ProductoBorrador[]>([PRODUCTO_VACIO]);
  const [publicando, setPublicando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arribaCuerpo, setArribaCuerpo] = useState(0);

  if (!profile) return null;
  if (profile.rol === 'admin' || profile.rol === 'admin_zona') return <Redirect href="/(app)/(tabs)/dashboard" />;

  async function publicar() {
    setAviso(null);
    if (!profile) return;
    if (!profile.logo_url) return setAviso('Pon tu foto de perfil (en Cuenta, tocando el círculo).');
    if (!profile.comuna_id || !profile.categoria_id) {
      return setAviso('Primero elige la comuna y la categoría de tu comercio en Cuenta.');
    }
    if (!profile.telefono_contacto) return setAviso('Pon tu teléfono en Cuenta.');
    const conAlgo = borrador.filter((x) => x.image || x.nombre.trim() || x.precio);
    if (conAlgo.length === 0) return setAviso('Toca la tarjeta para subir la foto del producto.');
    if (conAlgo.some((x) => !x.image)) return setAviso('Cada producto necesita su foto.');

    setPublicando(true);
    try {
      const productos = await Promise.all(
        conAlgo.map(async (x, i) => ({
          nombre: x.nombre.trim(),
          precio: Number(x.precio) || 0,
          imagen_url: await uploadCompressedImage('productos', profile.id, x.image!, `producto-${i}`),
        })),
      );
      await crearPublicacion({
        titulo: profile.nombre.trim(),
        categoriaId: profile.categoria_id,
        comunaId: profile.comuna_id,
        logoUrl: profile.logo_url,
        telefono: profile.telefono_contacto,
        productos,
      });
      // Con "Directo" (nivel 2) se publica al tiro: no hay nada que esperar.
      if (profile.nivel === 2) Alert.alert('¡Publicada!');
      else Alert.alert('¡Enviada!', 'Un administrador la revisará antes de que se vea en la app.');
      router.back();
    } catch (err) {
      setAviso(getErrorMessage(err, 'No se pudo publicar.'));
    } finally {
      setPublicando(false);
    }
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.negro, { height: u(NEGRO) }]} />
      <EncabezadoMarca subtitulo="Publicar" />

      <View style={styles.cuerpo} onLayout={(e) => setArribaCuerpo(e.nativeEvent.layout.y)}>
        <ScrollView
          contentContainerStyle={[styles.contenido, { paddingTop: Math.max(0, u(INICIO_TARJETA) - arribaCuerpo) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <TarjetaEditable
            logoUrl={profile.logo_url ?? null}
            titulo={profile.nombre}
            productos={borrador}
            onCambiar={setBorrador}
          />
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        </ScrollView>
      </View>

      <BotonPie label="Publicar" cargando={publicando} onPress={publicar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: Colors.backgroundSoft,
  },
  negro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
  },
  cuerpo: {
    flex: 1,
  },
  contenido: {
    paddingHorizontal: u(REJILLA.margenLateral),
    paddingBottom: Spacing.three,
  },
  aviso: {
    fontFamily: Fonts.light,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
