import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/catalog/CatalogState';
import { PRODUCTO_VACIO, ProductoBorrador, TarjetaEditable } from '@/components/catalog/TarjetaEditable';
import { BotonPie } from '@/components/ui/BotonPie';
import { EncabezadoMarca } from '@/components/ui/EncabezadoMarca';
import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  PublicacionDetalle,
  actualizarProducto,
  actualizarPublicacion,
  crearProducto,
  eliminarProducto,
  fetchPublicacionDetalle,
} from '@/lib/catalog';
import { getErrorMessage } from '@/lib/errors';
import { uploadCompressedImage } from '@/lib/images';
import { REJILLA, u } from '@/lib/rejilla';
import { AVISO_SIN_PERMISO, sinPermisoDeEditar, useSession } from '@/providers/SessionProvider';

/** Las mismas medidas que publicar: lo negro hasta 1000, la tarjeta en 890. */
const NEGRO = 1000;
const INICIO_TARJETA = 890;

/**
 * Editar una publicación (el lápiz en Publicaciones), igual que al crearla:
 *la tarjeta tal como se ve en el inicio, con sus
 * productos ya puestos. Se toca la foto, el nombre o el precio para cambiarlos,
 * se desliza para ver los demás o agregar otro, y se mantiene apretada una
 * foto para quitar ese producto. La foto, el nombre, la comuna y la categoría
 * del comercio son los del perfil.
 *
 * Quien no publica directo (nivel 1) vuelve a revisión al guardar; una
 * rechazada se reenvía.
 */
export default function EditarPublicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useSession();
  // Sin "Editar" no publica ni cambia nada (0057): se avisa y se vuelve.
  const sinPermiso = sinPermisoDeEditar(profile);
  useEffect(() => {
    if (!sinPermiso) return;
    Alert.alert('Sin permiso', AVISO_SIN_PERMISO);
    router.back();
  }, [sinPermiso, router]);
  const [publicacion, setPublicacion] = useState<PublicacionDetalle | null>(null);
  const [borrador, setBorrador] = useState<ProductoBorrador[]>([PRODUCTO_VACIO]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arribaCuerpo, setArribaCuerpo] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detalle = await fetchPublicacionDetalle(id);
      setPublicacion(detalle);
      if (detalle) {
        const productos = [...detalle.productos]
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio > 0 ? String(p.precio) : '',
            image: null,
            imagenUrl: p.imagen_url,
          }));
        setBorrador(productos.length > 0 ? productos : [PRODUCTO_VACIO]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Error desconocido.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function guardar() {
    if (!publicacion || !profile) return;
    setAviso(null);
    const conAlgo = borrador.filter((x) => x.image || x.imagenUrl || x.nombre.trim() || x.precio);
    if (conAlgo.length === 0) return setAviso('Toca la tarjeta para subir la foto del producto.');
    if (conAlgo.some((x) => !x.image && !x.imagenUrl)) return setAviso('Cada producto necesita su foto.');

    const rechazada = publicacion.estado === 'rechazado';
    const aRevision = rechazada || profile.nivel !== 2;
    setGuardando(true);
    try {
      await actualizarPublicacion(publicacion.id, {
        titulo: profile.nombre.trim() || publicacion.titulo,
        categoriaId: profile.categoria_id ?? publicacion.categoria_id,
        comunaId: profile.comuna_id,
        logoUrl: profile.logo_url ?? publicacion.logo_url,
        telefono: profile.telefono_contacto ?? publicacion.telefono,
        aRevision,
      });

      // Los que se quitaron, se borran; los demás se guardan en su orden.
      const quedan = new Set(conAlgo.map((x) => x.id).filter(Boolean));
      await Promise.all(publicacion.productos.filter((p) => !quedan.has(p.id)).map((p) => eliminarProducto(p.id)));
      for (const [orden, x] of conAlgo.entries()) {
        const imagen_url = x.image
          ? await uploadCompressedImage('productos', profile.id, x.image, `producto-${Date.now()}-${orden}`)
          : (x.imagenUrl ?? null);
        const datos = { nombre: x.nombre.trim(), precio: Number(x.precio) || 0, imagen_url };
        if (x.id) await actualizarProducto(x.id, datos);
        else await crearProducto(publicacion.id, { ...datos, orden });
      }

      if (aRevision) Alert.alert('¡Enviada!', 'Un administrador la revisará antes de que vuelva a verse.');
      else Alert.alert('¡Guardada!');
      router.back();
    } catch (err) {
      setAviso(getErrorMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.negro, { height: u(NEGRO) }]} />
      <EncabezadoMarca subtitulo="Editar" />

      <View style={styles.cuerpo} onLayout={(e) => setArribaCuerpo(e.nativeEvent.layout.y)}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !publicacion || !profile ? (
          <EmptyState sobreClaro title="No encontramos esta publicación" message="Puede que ya no exista." />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.contenido, { paddingTop: Math.max(0, u(INICIO_TARJETA) - arribaCuerpo) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <TarjetaEditable
              logoUrl={profile.logo_url ?? publicacion.logo_url}
              titulo={profile.nombre}
              productos={borrador}
              onCambiar={setBorrador}
            />
            {publicacion.estado === 'rechazado' && publicacion.rechazo_foto ? (
              <Text style={styles.nota}>{`Fue rechazada por la imagen ${publicacion.rechazo_foto}: cámbiala y guarda.`}</Text>
            ) : null}
            {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
          </ScrollView>
        )}
      </View>

      {publicacion && profile && (
        <BotonPie label="Guardar" cargando={guardando} onPress={guardar} />
      )}
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
  nota: {
    fontFamily: Fonts.light,
    fontSize: 14,
    color: Colors.cardTextMuted,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  aviso: {
    fontFamily: Fonts.light,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
