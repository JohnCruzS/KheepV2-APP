import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/catalog/CatalogState';
import { CategoryChips } from '@/components/catalog/CategoryChips';
import { ImageViewer } from '@/components/catalog/ImageViewer';
import { PublicacionCard } from '@/components/catalog/PublicacionCard';
import { PRODUCTO_VACIO, TarjetaEditable } from '@/components/catalog/TarjetaEditable';
import { BotonPie } from '@/components/ui/BotonPie';
import { EncabezadoMarca } from '@/components/ui/EncabezadoMarca';
import { FotoRemota } from '@/components/ui/FotoRemota';
import { ListaArrastrable } from '@/components/ui/ListaArrastrable';
import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  Categoria,
  MiPublicacion,
  eliminarPublicacion,
  fetchCategorias,
  fetchMisPublicaciones,
  ocultarMiPublicacion,
  ordenarMisPublicaciones,
} from '@/lib/catalog';
import { getErrorMessage } from '@/lib/errors';
import { REJILLA, u } from '@/lib/rejilla';
import { AVISO_SIN_PERMISO, sinPermisoDeEditar, useSession } from '@/providers/SessionProvider';

type Vista = 'perfil' | 'publicaciones';
type Filtro = 'aprobado' | 'pendiente' | 'rechazado';

const FILTROS: Categoria[] = [
  { id: 'aprobado', nombre: 'Activas', icono: null, orden: 1 },
  { id: 'pendiente', nombre: 'Espera', icono: null, orden: 2 },
  { id: 'rechazado', nombre: 'Rechazo', icono: null, orden: 3 },
];

/**
 * Cuánto baja lo negro bajo la fila de arriba: la
 * primera tarjeta queda montada en el borde entre lo negro y lo gris.
 */
/**
 * "Mi Perfil", con las mismas proporciones del inicio (rejilla de 1000 de
 * ancho, desde el borde de arriba de la pantalla): el
 * banner, la fila de categorías justo debajo y la tarjeta justo después. Lo
 * negro baja 41 más que la tarjeta, como en el inicio.
 */
const PERFIL = {
  banner: REJILLA.bannerSuperior,
  bannerAlto: REJILLA.bannerAlto,
  categorias: REJILLA.bannerSuperior + REJILLA.bannerAlto,
  categoriasAlto: REJILLA.categoriasAlto,
  tarjeta: REJILLA.bannerSuperior + REJILLA.bannerAlto + REJILLA.categoriasAlto,
};
const SOLAPE_PERFIL = 41;
/** Los filtros Activas / Espera / Rechazo: una fila más baja que la del inicio. */
const ALTO_FILTROS = u(120);
const SOLAPE_PUBLICACIONES = 290;
/** Alto de la foto en la tarjeta del feed, y de la tarjeta entera (todas iguales, para reordenar). */
const ALTO_FOTO = u(430);
const ALTO_TARJETA = 56 + ALTO_FOTO + 56;
const SEPARACION = u(REJILLA.margenLateral);

/**
 * El "+" del comerciante. Dos vistas; dos toques en el
 * logo pasan de una a otra:
 *
 *  - "Publicaciones" (la que se abre): donde se gestiona todo. Arriba
 *    "Publicar" (crear una) y los filtros Activas / Espera / Rechazo; cada
 *    publicación es una tarjeta con ocultar (el ojo), editar y eliminar, y se
 *    reordena arrastrándola por la flecha.
 *  - "Mi Perfil": la vista previa de cómo se ve el comercio, con las
 *    proporciones del inicio —un banner de ejemplo, su categoría y su
 *    tarjeta—. No cambia de categoría: así la tarjeta siempre se ve.
 */
export default function PublicarScreen() {
  const router = useRouter();
  const { session, profile } = useSession();
  // Primero la lista de publicaciones; dos toques en el logo pasan a la vista
  // previa del perfil y vuelven.
  const [vista, setVista] = useState<Vista>('publicaciones');
  const alternarVista = () => setVista((v) => (v === 'perfil' ? 'publicaciones' : 'perfil'));
  const [publicaciones, setPublicaciones] = useState<MiPublicacion[] | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('aprobado');
  const [arrastrando, setArrastrando] = useState(false);
  /** Dónde termina la fila de arriba de cada vista (desde arriba de la pantalla). */
  const [finPublicaciones, setFinPublicaciones] = useState(0);
  /** Dónde empieza lo que se desliza en "Mi Perfil" (bajo el título). */
  const [arribaScroll, setArribaScroll] = useState(0);

  const cargar = useCallback(() => {
    fetchMisPublicaciones()
      .then(setPublicaciones)
      .catch(() => setPublicaciones((p) => p ?? []));
  }, []);
  useFocusEffect(cargar);

  // Las categorías de su comuna: para el nombre de la suya en "Mi Perfil".
  useEffect(() => {
    fetchCategorias(profile?.comuna_id ?? null)
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [profile?.comuna_id]);

  if (!session) return null;
  if (profile && (profile.rol === 'admin' || profile.rol === 'admin_zona')) {
    return <Redirect href="/(app)/(tabs)/dashboard" />;
  }

  // Sin "Editar" (lo apaga un administrador) no publica ni cambia lo suyo: la
  // base no lo deja (0057) y acá se avisa en vez de no hacer nada.
  const sinPermiso = sinPermisoDeEditar(profile);
  const avisarSinPermiso = () => Alert.alert('Sin permiso', AVISO_SIN_PERMISO);
  const publicar = () => (sinPermiso ? avisarSinPermiso() : router.push('/(app)/publicacion/nueva'));
  const editar = (id: string) => router.push({ pathname: '/(app)/publicacion/editar/[id]', params: { id } });

  async function alternarOculta(p: MiPublicacion) {
    const oculta = !p.oculta;
    setPublicaciones((lista) => lista?.map((x) => (x.id === p.id ? { ...x, oculta } : x)) ?? null);
    try {
      await ocultarMiPublicacion(p.id, oculta);
    } catch (err) {
      setPublicaciones((lista) => lista?.map((x) => (x.id === p.id ? { ...x, oculta: p.oculta } : x)) ?? null);
      Alert.alert('No se pudo cambiar', getErrorMessage(err, 'Intenta de nuevo.'));
    }
  }

  function eliminar(p: MiPublicacion) {
    Alert.alert('Eliminar publicación', 'Se quita del catálogo y de tu lista. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarPublicacion(p.id);
            setPublicaciones((lista) => lista?.filter((x) => x.id !== p.id) ?? null);
          } catch (err) {
            Alert.alert('No se pudo eliminar', getErrorMessage(err, 'Intenta de nuevo.'));
          }
        },
      },
    ]);
  }

  /** Reordenadas las del filtro: se guarda el orden de toda la lista. */
  async function reordenar(nuevas: MiPublicacion[]) {
    if (!publicaciones) return;
    const cola = [...nuevas];
    const todas = publicaciones.map((x) => (x.estado === filtro ? cola.shift()! : x));
    setPublicaciones(todas);
    try {
      await ordenarMisPublicaciones(todas.map((x) => x.id));
    } catch (err) {
      Alert.alert('No se pudo guardar el orden', getErrorMessage(err, 'Intenta de nuevo.'));
      cargar();
    }
  }

  // Todas las visibles, sin filtrar por categoría: la tarjeta del comercio
  // se ve siempre. Arriba, solo la categoría del
  // comercio (la de su perfil), en rojo.
  const visibles = (publicaciones ?? []).filter((p) => p.estado === 'aprobado' && !p.oculta);
  // Sin categoría elegida, la primera de la comuna: la que el inicio muestra al entrar.
  const propia = categorias.find((c) => c.id === profile?.categoria_id) ?? categorias[0];
  const suCategoria = propia ? [propia] : [];
  const delFiltro = (publicaciones ?? []).filter((p) => p.estado === filtro);
  // Hasta dónde llega lo negro (se calcula acá: las medidas llegan en
  // cualquier orden).
  const negro = vista === 'perfil' ? u(PERFIL.tarjeta) + SOLAPE_PERFIL : finPublicaciones + u(SOLAPE_PUBLICACIONES);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={[styles.negro, { height: negro }]} />

      {vista === 'perfil' ? (
        <>
          <EncabezadoMarca subtitulo="Mi Perfil" onDobleToque={alternarVista} />
          {/* Como el inicio: el banner y las categorías quedan fijos y solo
              se mueven las publicaciones. Medidas del diseño. */}
          <View style={[styles.banner, { top: u(PERFIL.banner), height: u(PERFIL.bannerAlto) }]} pointerEvents="none">
            <Text style={styles.bannerTexto}>Banner publicidad</Text>
          </View>
          <View style={[styles.filaCategorias, { top: u(PERFIL.categorias), height: u(PERFIL.categoriasAlto) }]}>
            <CategoryChips categorias={suCategoria} selectedId={suCategoria[0]?.id ?? null} onSelect={() => {}} />
          </View>
          <View style={styles.cuerpo} onLayout={(e) => setArribaScroll(e.nativeEvent.layout.y)}>
            <ScrollView
              style={[styles.listaPerfil, { top: Math.max(0, u(PERFIL.tarjeta) - arribaScroll) }]}
              contentContainerStyle={styles.tarjetas}
              showsVerticalScrollIndicator={false}>
              {publicaciones === null ? (
                <LoadingState />
              ) : visibles.length === 0 ? (
                // Sin publicaciones a la vista: la tarjeta de ejemplo lleva a publicar.
                <TarjetaEditable
                  logoUrl={profile?.logo_url ?? null}
                  titulo={profile?.nombre ?? ''}
                  productos={[PRODUCTO_VACIO]}
                  onCambiar={() => {}}
                  onTocar={publicar}
                />
              ) : (
                // Una sola tarjeta para todo el comercio:
                // su galería pasa por los productos de todas sus publicaciones.
                <View style={styles.tarjeta}>
                  <PublicacionCard
                    publicacion={{
                      ...visibles[0],
                      productos: visibles
                        .flatMap((p) => [...p.productos].sort((a, b) => a.orden - b.orden))
                        .map((x, orden) => ({ ...x, orden })),
                    }}
                    onContactar={() => {}}
                    onVerFoto={setFoto}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </>
      ) : (
        <>
          {/* El nombre del negocio, no "Publicaciones". */}
          <EncabezadoMarca subtitulo={profile?.nombre || 'Publicaciones'} onDobleToque={alternarVista} />
          <View onLayout={(e) => setFinPublicaciones(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            <BotonPie label="Publicar" sinEspacioDebajo onPress={publicar} />
            <View style={styles.filtros}>
              <CategoryChips
                categorias={FILTROS}
                selectedId={filtro}
                onSelect={(id) => setFiltro(id as Filtro)}
                alto={ALTO_FILTROS}
                centrado
              />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.contenido} scrollEnabled={!arrastrando} showsVerticalScrollIndicator={false}>
            {publicaciones === null ? (
              <LoadingState />
            ) : delFiltro.length === 0 ? (
              // Al centro del negro que queda bajo los filtros.
              <View style={styles.vacioCaja}>
                <Text style={styles.vacio}>Sin publicaciones</Text>
              </View>
            ) : (
              <ListaArrastrable
                datos={delFiltro}
                altoFila={ALTO_TARJETA + SEPARACION}
                claveDe={(p) => p.id}
                onReordenar={(nuevas) => void reordenar(nuevas)}
                onArrastrando={setArrastrando}>
                {(p, _i, moviendo, propsAsa) => (
                  <TarjetaFeed
                    publicacion={p}
                    moviendo={moviendo}
                    propsAsa={propsAsa}
                    onOcultar={() => void alternarOculta(p)}
                    onEditar={() => editar(p.id)}
                    onEliminar={() => eliminar(p)}
                    soloVer={sinPermiso}
                  />
                )}
              </ListaArrastrable>
            )}
          </ScrollView>
        </>
      )}

      {foto && <ImageViewer images={[foto]} visible initialIndex={0} onClose={() => setFoto(null)} />}
    </SafeAreaView>
  );
}

/**
 * Una publicación en el feed: flecha para moverla,
 * estado, ojo, editar y eliminar. Con `soloVer` (sin permiso de editar), solo
 * el estado: sin flecha ni botones.
 */
function TarjetaFeed({
  publicacion: p,
  moviendo,
  propsAsa,
  onOcultar,
  onEditar,
  onEliminar,
  soloVer,
}: {
  publicacion: MiPublicacion;
  moviendo: boolean;
  propsAsa: object;
  onOcultar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  soloVer?: boolean;
}) {
  const productos = [...p.productos].sort((a, b) => a.orden - b.orden);
  const portada = productos.find((x) => x.imagen_url) ?? productos[0];
  const estado =
    p.estado === 'pendiente' ? 'En espera' : p.estado === 'rechazado' ? 'Rechazada' : p.oculta ? 'Oculta' : 'Visible';
  return (
    <View style={[styles.feed, moviendo && styles.feedMoviendo]}>
      <View style={styles.feedCabecera}>
        {soloVer ? (
          <View style={styles.asa} />
        ) : (
          <View {...propsAsa} style={styles.asa} accessibilityLabel="Mover">
            <Text style={styles.asaIcono}>➤</Text>
          </View>
        )}
        <Text style={[styles.feedEstado, p.oculta && styles.feedOculta]} numberOfLines={1}>
          {estado}
        </Text>
        {!soloVer && p.estado === 'aprobado' && (
          <Pressable onPress={onOcultar} hitSlop={10} accessibilityLabel={p.oculta ? 'Mostrar' : 'Ocultar'}>
            <Ionicons name={p.oculta ? 'eye-off-outline' : 'eye-outline'} size={26} color="#000000" />
          </Pressable>
        )}
        {!soloVer && (
          <>
            <Pressable onPress={onEditar} hitSlop={10} accessibilityLabel="Editar">
              <Ionicons name="create-outline" size={25} color="#000000" />
            </Pressable>
            <Pressable onPress={onEliminar} hitSlop={10} accessibilityLabel="Eliminar">
              <Ionicons name="close-outline" size={32} color="#000000" />
            </Pressable>
          </>
        )}
      </View>
      {portada?.imagen_url ? (
        <FotoRemota uri={portada.imagen_url} ancho={360} style={[styles.feedFoto, p.oculta && styles.feedFotoOculta]} />
      ) : (
        <View style={[styles.feedFoto, styles.feedFotoVacia]} />
      )}
      <View style={styles.feedPie}>
        <Text style={styles.feedNombre} numberOfLines={1}>
          {portada?.nombre || 'Producto'}
          {productos.length > 1 ? `  +${productos.length - 1}` : ''}
        </Text>
        {portada && portada.precio > 0 ? <Text style={styles.feedPrecio}>{portada.precio.toLocaleString('es-CL')}</Text> : null}
      </View>
    </View>
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
  scroll: {
    paddingBottom: Spacing.three,
  },
  banner: {
    position: 'absolute',
    left: u(REJILLA.margenLateral),
    right: u(REJILLA.margenLateral),
    borderRadius: u(REJILLA.curvatura),
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTexto: {
    fontFamily: Fonts.light,
    fontSize: 24,
    color: '#111111',
  },
  // Con el margen del contenedor del inicio: la categoría entra igual que allá.
  filaCategorias: {
    position: 'absolute',
    left: u(REJILLA.margenLateral),
    right: u(REJILLA.margenLateral),
    justifyContent: 'center',
  },
  cuerpo: {
    flex: 1,
  },
  // Solo esto se desliza: desde la primera tarjeta hasta el botón.
  listaPerfil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tarjetas: {
    paddingHorizontal: u(REJILLA.margenLateral),
    paddingBottom: Spacing.three,
  },
  tarjeta: {
    marginBottom: u(REJILLA.margenLateral),
  },
  // Medido en pantalla: así los filtros quedan justo al centro entre
  // "Publicar" y la primera tarjeta (sin esto, unos 6 puntos más arriba).
  filtros: {
    paddingTop: 4.5,
  },
  contenido: {
    paddingHorizontal: u(REJILLA.margenLateral),
    paddingBottom: Spacing.three,
  },
  // Corto, sobre lo negro, y grande como en el diseño (ocupa
  // algo más de la mitad del ancho): 26 en una pantalla como la del diseño.
  vacio: {
    fontFamily: Fonts.delgada,
    fontSize: u(64),
    lineHeight: u(64) * 1.4,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Medido en pantalla: con la caja sola el texto quedaba 7 puntos bajo el
  // centro (los filtros de arriba ya dejan algo de aire).
  vacioCaja: {
    height: u(SOLAPE_PUBLICACIONES),
    justifyContent: 'center',
    transform: [{ translateY: -7.5 }],
  },
  // La tarjeta del feed: blanca, como el diseño.
  feed: {
    height: ALTO_TARJETA,
    backgroundColor: Colors.card,
    borderRadius: u(REJILLA.curvatura),
    paddingRight: Spacing.three,
  },
  feedMoviendo: {
    opacity: 0.85,
  },
  feedCabecera: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // "Visible" empieza donde empieza la foto (56 desde el borde): la flecha
  // descuenta el espacio que la fila deja entre uno y otro.
  asa: {
    width: 56,
    height: 56,
    marginRight: -Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La flecha es de la letra del sistema y cae más abajo que "Visible" (Poppins):
  // se corrige lo medido para que las dos queden al centro de la fila, a la
  // altura de los íconos.
  asaIcono: {
    fontSize: 22,
    color: '#000000',
    transform: [{ translateY: -2 }],
  },
  // Poppins queda alta en su línea: se baja lo medido para centrarla.
  feedEstado: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 21,
    color: '#000000',
    transform: [{ translateY: 2.5 }],
  },
  feedOculta: {
    color: Colors.cardTextMuted,
  },
  feedFoto: {
    height: ALTO_FOTO,
    marginLeft: 56,
    borderRadius: 10,
  },
  feedFotoOculta: {
    opacity: 0.45,
  },
  feedFotoVacia: {
    backgroundColor: '#D9D9D9',
  },
  feedPie: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 56,
  },
  feedNombre: {
    flexShrink: 1,
    fontFamily: Fonts.light,
    fontSize: 18,
    color: Colors.cardText,
  },
  feedPrecio: {
    fontFamily: Fonts.light,
    fontSize: 18,
    color: Colors.cardText,
    marginLeft: Spacing.two,
  },
});
