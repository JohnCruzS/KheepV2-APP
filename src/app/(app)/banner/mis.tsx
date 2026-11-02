import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorPantalla } from '@/components/admin/EditorPantalla';
import { UbicacionBanner } from '@/components/admin/UbicacionBanner';
import { LoadingState } from '@/components/catalog/CatalogState';
import { MedioBanner } from '@/components/catalog/MedioBanner';
import { AjusteAPantalla } from '@/components/ui/AjusteAPantalla';
import { BotonPie } from '@/components/ui/BotonPie';
import { EncabezadoMarca, useHuecoHastaBanner } from '@/components/ui/EncabezadoMarca';
import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  MiBanner,
  cambiarEnlaceBanner,
  eliminarBanner,
  fetchMisBanners,
  pagarConFlow,
  pausarBanner,
  precioDeBanners,
  reenviarBanner,
} from '@/lib/catalog';
import { getErrorMessage } from '@/lib/errors';
import { pickAndCompressImage, uploadCompressedImage } from '@/lib/images';
import { REJILLA, u } from '@/lib/rejilla';
import { sincronizarReloj } from '@/lib/relojServidor';
import { progresoBanner, tiempoBanner, enlaceCorto } from '@/lib/tiempoBanner';
import { useSession } from '@/providers/SessionProvider';

/** Un banner del comerciante: sus copias (una por comuna) van juntas. */
type Grupo = { banner: MiBanner; copias: MiBanner[] };

/**
 * "Mis banners" del comerciante: la misma vista que
 * Banners del admin, pero solo con los suyos. La imagen se pasa con el dedo;
 * debajo, cuál es de cuántos, la línea de avance, la pausa, el tiempo (tocarlo
 * cambia a lo que le queda), las vistas (V veces / U dispositivos), el enlace
 * (tocarlo lo abre, mantenerlo lo cambia), dónde sale y Eliminar. "Nuevo"
 * crea otro. Sin banners, se abre directo la pantalla para crear el primero.
 */
export default function MisBannersScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const hueco = useHuecoHastaBanner();
  const [banners, setBanners] = useState<MiBanner[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [ancho, setAncho] = useState(0);
  const [verRestante, setVerRestante] = useState(false);
  const [verUnicas, setVerUnicas] = useState(false);
  const [ubicacion, setUbicacion] = useState<string[] | null | undefined>(undefined);
  const [editandoEnlace, setEditandoEnlace] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Lo que cuesta el banner que se ve, si falta pagarlo. */
  const [precio, setPrecio] = useState<number | null>(null);
  /** Evita abrir el pago dos veces con toques seguidos. */
  const pagando = useRef(false);
  const [, setTic] = useState(0);

  const cargar = useCallback(() => {
    fetchMisBanners()
      .then(({ banners: lista }) => setBanners(lista))
      .catch(() => setBanners((b) => b ?? []));
  }, []);
  useFocusEffect(cargar);

  // El tiempo se redibuja cada segundo.
  useEffect(() => {
    // Se cuenta con la hora del servidor, no la del teléfono.
    void sincronizarReloj();
    const id = setInterval(() => setTic((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const grupos = useMemo<Grupo[]>(() => {
    const porImagen = new Map<string, MiBanner[]>();
    for (const b of banners ?? []) {
      const lista = porImagen.get(b.imagen_url);
      if (lista) lista.push(b);
      else porImagen.set(b.imagen_url, [b]);
    }
    return [...porImagen.values()].map((copias) => ({
      banner: copias[0],
      copias,
    }));
  }, [banners]);

  const visto = grupos[Math.min(indice, grupos.length - 1)] as Grupo | undefined;
  const idsPorPagar = visto && visto.banner.estado === 'aprobado' ? visto.copias.filter((c) => !c.pagado).map((c) => c.id) : [];
  const clavePorPagar = idsPorPagar.join(',');

  // El precio lo calcula la base: es lo mismo que se cobra en Flow.
  useEffect(() => {
    setPrecio(null);
    if (!clavePorPagar) return;
    let vigente = true;
    precioDeBanners(clavePorPagar.split(','))
      .then((p) => vigente && setPrecio(p))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [clavePorPagar]);

  if (profile && profile.rol !== 'comerciante') return <Redirect href="/(app)/admin/banners" />;
  if (banners === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState />
      </SafeAreaView>
    );
  }
  // Sin banners: directo a crear el primero.
  if (grupos.length === 0) return <Redirect href="/(app)/banner/publicar" />;

  const g = grupos[Math.min(indice, grupos.length - 1)];
  const actual = g.banner;
  const pausado = !!actual.pausado_en;
  const avance = progresoBanner(actual);

  function alDeslizar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (ancho > 0) setIndice(Math.max(0, Math.min(grupos.length - 1, Math.round(e.nativeEvent.contentOffset.x / ancho))));
  }

  async function alternarPausa() {
    setOcupado(true);
    try {
      await Promise.all(g.copias.map((c) => pausarBanner(c.id, !pausado)));
      cargar();
    } catch (err) {
      Alert.alert(pausado ? 'No se pudo reanudar' : 'No se pudo pausar', getErrorMessage(err, 'Intenta de nuevo.'));
    } finally {
      setOcupado(false);
    }
  }

  function eliminar() {
    Alert.alert('Eliminar banner', 'Deja de mostrarse y se borra. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setOcupado(true);
          try {
            for (const c of g.copias) await eliminarBanner(c.id);
            setIndice(0);
            cargar();
          } catch (err) {
            Alert.alert('No se pudo eliminar', getErrorMessage(err, 'Intenta de nuevo.'));
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  }

  /** Rechazado: tocar la imagen elige otra y lo reenvía a revisión. */
  async function cambiarImagen() {
    if (actual.estado !== 'rechazado' || !profile) return;
    try {
      const nueva = await pickAndCompressImage({ uso: 'banner' });
      if (!nueva) return;
      setOcupado(true);
      const url = await uploadCompressedImage('banners', profile.id, nueva, `banner-${Date.now()}`);
      await Promise.all(g.copias.map((c) => reenviarBanner(c.id, url)));
      Alert.alert('Reenviado', 'Tu banner volvió a revisión.');
      cargar();
    } catch (err) {
      Alert.alert('No se pudo reenviar', getErrorMessage(err, 'Intenta de nuevo.'));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Aprobado y sin pagar: se abre la página de pago de Flow. Al volver se
   * recarga unas veces, porque Flow avisa el pago a la base un momento
   * después.
   */
  async function pagar() {
    if (pagando.current) return;
    pagando.current = true;
    setOcupado(true);
    try {
      const url = await pagarConFlow(idsPorPagar);
      await WebBrowser.openAuthSessionAsync(url, 'kheep://banner/mis');
      for (let i = 0; i < 4; i++) {
        const { banners: lista } = await fetchMisBanners();
        setBanners(lista);
        if (lista.filter((b) => idsPorPagar.includes(b.id)).every((b) => b.pagado)) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      Alert.alert('No se pudo pagar', getErrorMessage(err, 'Intenta de nuevo.'));
    } finally {
      pagando.current = false;
      setOcupado(false);
    }
  }

  function abrirEnlace(enlace: string) {
    const url = /^https?:\/\//i.test(enlace) ? enlace : `https://${enlace}`;
    Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace', 'Revisa que esté bien escrito.'));
  }

  // Lo que va donde el tiempo: el estado si todavía no se muestra.
  const estado =
    actual.estado === 'pendiente'
      ? 'En revisión'
      : actual.estado === 'rechazado'
        ? 'Rechazado · toca la imagen'
        : !actual.pagado
          ? 'Pendiente de pago'
          : null;
  const enComunas = g.copias.some((c) => c.comuna_id === null) ? null : g.copias.map((c) => c.comuna_id as string);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <EncabezadoMarca subtitulo="Mis banners" />

      <View style={[styles.marco, { marginTop: hueco }]} onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={alDeslizar}
          style={styles.tira}>
          {grupos.map(({ banner }, i) => (
            <Pressable key={banner.id} onPress={cambiarImagen} disabled={banner.estado !== 'rechazado'}>
              <MedioBanner
                uri={banner.imagen_url}
                ancho={ancho}
                style={[styles.imagen, { width: ancho }, (banner.pausado_en || banner.estado !== 'aprobado') && styles.apagada]}
                activo={i === indice}
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <AjusteAPantalla style={styles.contenido} llenar>
        <Text style={styles.cupo}>
          {indice + 1}/{grupos.length}
        </Text>

        <View style={styles.barra}>
          <View style={styles.barraFondo} />
          <View style={[styles.barraLlena, { width: `${avance * 100}%` }]} />
          <View style={[styles.barraPunto, { left: `${avance * 100}%` }]} />
        </View>

        <View style={styles.fila}>
          <View style={[styles.filaIzquierda, styles.conPausa]}>
            {!estado && (
              <Pressable onPress={() => void alternarPausa()} disabled={ocupado} hitSlop={12} accessibilityRole="button">
                <Ionicons
                  name={pausado ? 'play' : 'pause'}
                  size={22}
                  color={pausado ? Colors.accent : Colors.text}
                  // Medido: el ícono caía 2 puntos bajo los números de al lado.
                  style={{ transform: [{ translateY: -2 }] }}
                />
              </Pressable>
            )}
            {/* Falta pagar: "Pagar $75.000" en rojo, tocarlo abre Flow. */}
            {estado === 'Pendiente de pago' ? (
              <Pressable
                onPress={() => void pagar()}
                disabled={ocupado}
                hitSlop={8}
                style={styles.filaIzquierda}
                accessibilityRole="button">
                <Text style={[styles.tiempo, styles.pagar]} numberOfLines={1}>
                  {ocupado ? 'Abriendo el pago…' : precio ? `Pagar $${precio.toLocaleString('es-CL')}` : 'Pagar'}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setVerRestante((v) => !v)} hitSlop={8} style={styles.filaIzquierda} disabled={!!estado}>
                <Text style={[styles.tiempo, estado === 'Rechazado · toca la imagen' && styles.rechazado]} numberOfLines={1}>
                  {estado ?? tiempoBanner(actual, verRestante)}
                </Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => setVerUnicas((v) => !v)} hitSlop={8}>
            <Text style={styles.valor}>
              <Text style={styles.letra}>{verUnicas ? 'U ' : 'V '}</Text>
              {(verUnicas ? (actual.vistas_unicas ?? 0) : (actual.vistas ?? 0)).toLocaleString('es-CL')}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.fila}
          onPress={actual.enlace ? () => abrirEnlace(actual.enlace!) : undefined}
          onLongPress={() => setEditandoEnlace(true)}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityHint="Toca para abrir el enlace; mantén apretado para cambiarlo">
          <Text style={[actual.enlace ? styles.valor : styles.tiempo, styles.filaIzquierda]} numberOfLines={1}>
            {actual.enlace ? enlaceCorto(actual.enlace) : 'Sin enlace'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ubicacion, pressed && styles.pressed]}
          onPress={() => setUbicacion(enComunas)}
          accessibilityRole="button">
          <Text style={styles.ubicacionLabel}>Ubicación</Text>
        </Pressable>

        {/* Al centro del espacio entre "Ubicación" y "Nuevo", como en Banners del admin. */}
        <View style={styles.zonaEliminar}>
          <Pressable onPress={eliminar} disabled={ocupado} hitSlop={8} accessibilityRole="button">
            <Text style={styles.eliminar}>Eliminar</Text>
          </Pressable>
        </View>
      </AjusteAPantalla>

      <BotonPie label="Nuevo" onPress={() => router.push('/(app)/banner/publicar')} />

      <UbicacionBanner visible={ubicacion !== undefined} comunaIds={ubicacion ?? null} onClose={() => setUbicacion(undefined)} />

      <EditorPantalla
        visible={editandoEnlace}
        subtitulo="Enlace"
        placeholder="Enlace"
        inicial={actual.enlace ?? ''}
        propsCampo={{
          keyboardType: 'url',
          autoCapitalize: 'none',
          autoCorrect: false,
        }}
        validar={(v) => (!v.trim() || /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(v.trim()) ? null : 'Escribe un enlace válido.')}
        onCerrar={() => setEditandoEnlace(false)}
        onGuardar={async (v) => {
          await cambiarEnlaceBanner(actual.imagen_url, v);
          cargar();
        }}
      />
    </SafeAreaView>
  );
}

const margen = u(REJILLA.margenLateral);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contenido: {
    paddingBottom: Spacing.four,
  },
  marco: {
    marginHorizontal: margen,
    borderRadius: u(REJILLA.curvatura),
    overflow: 'hidden',
  },
  tira: {
    flexGrow: 0,
  },
  imagen: {
    height: u(REJILLA.bannerAlto),
    backgroundColor: Colors.surface,
  },
  apagada: {
    opacity: 0.4,
  },
  cupo: {
    fontFamily: Fonts.delgada,
    fontSize: 24,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  barra: {
    height: 12,
    marginHorizontal: margen,
    justifyContent: 'center',
  },
  barraFondo: {
    height: 2,
    backgroundColor: '#FFFFFF',
  },
  barraLlena: {
    position: 'absolute',
    left: 0,
    height: 2,
    backgroundColor: Colors.accent,
  },
  barraPunto: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginHorizontal: margen * 2,
    marginTop: Spacing.four,
  },
  filaIzquierda: {
    flexShrink: 1,
  },
  pagar: {
    color: Colors.accent,
  },
  conPausa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  tiempo: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.textMuted,
  },
  rechazado: {
    color: Colors.accent,
  },
  valor: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.text,
  },
  letra: {
    color: Colors.textMuted,
  },
  ubicacion: {
    marginHorizontal: margen * 1.5,
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  ubicacionLabel: {
    fontFamily: Fonts.medium,
    fontSize: 22,
    color: '#000000',
  },
  pressed: {
    opacity: 0.7,
  },
  eliminar: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.accent,
    textAlign: 'center',
  },
  // Igual que en Banners del admin: el relleno de arriba compensa el del
  // contenido y el aire sobre "Nuevo", que quedan debajo de esta zona.
  zonaEliminar: {
    flex: 1,
    minHeight: 72,
    paddingTop: 45,
    justifyContent: 'center',
  },
});
