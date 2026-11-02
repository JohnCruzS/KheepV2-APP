import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { EditorPantalla } from '@/components/admin/EditorPantalla';
import { ComunaPicker } from '@/components/catalog/ComunaPicker';
import { FotoRemota } from '@/components/ui/FotoRemota';
import { Text } from '@/components/ui/Texto';
import { TextoDeslizante } from '@/components/ui/TextoDeslizante';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  Categoria,
  Comuna,
  cambiarMiCorreo,
  cambiarMiFoto,
  cambiarMiNegocio,
  cambiarMiNombre,
  cambiarMiTelefono,
  eliminarMiCuenta,
  fetchCategorias,
  fetchComunas,
  fetchMiVisibilidad,
  pausarMiPerfil,
} from '@/lib/catalog';
import { cambiarMiClave } from '@/lib/administradores';
import { getErrorMessage } from '@/lib/errors';
import { pickAndCompressImage, uploadCompressedImage } from '@/lib/images';
import { REJILLA, u } from '@/lib/rejilla';
import { supabase } from '@/lib/supabase';
import {
  MENSAJE_CELULAR,
  celularConEspacios,
  celularLocal,
  isValidChileanPhone,
  isValidEmail,
  normalizeChileanPhone,
  soloCelular,
} from '@/lib/validation';
import { useSession } from '@/providers/SessionProvider';

type Perfil = NonNullable<ReturnType<typeof useSession>['profile']>;

/** "+56987654321" pasa a "9 876 543 21", como en el diseño. */
function telefonoLegible(telefono: string | null): string {
  return celularConEspacios(celularLocal(telefono)) || '—';
}

/**
 * El perfil del comerciante, con la lógica de una
 * página de negocio: el comercio tiene una comuna y una categoría (giro), y
 * sus publicaciones se muestran ahí.
 *
 *  - Arriba: la foto (tocarla la cambia), el nombre, "Visible" (tocarlo lo
 *    pausa o lo vuelve a mostrar), el correo y el teléfono (tocarlos los
 *    cambia).
 *  - Abajo: la comuna (en rojo; tocarla elige otra), la categoría (botón
 *    rojo; tocarlo elige una de las de su comuna), "Mis banners" y "Salir".
 *
 * Las publicaciones siguen siempre al comercio (0051): al cambiar la comuna
 * o la categoría, todas se mueven a lo elegido. Al mudarse, la categoría se
 * mantiene si la nueva comuna la tiene; si no, queda vacía hasta elegirla con
 * el botón (mientras, las publicaciones esperan en "Otro"). Los 3 primeros
 * cambios son libres; después hay que esperar 7 días (lo controla la base).
 */
/**
 * Lo último que se vio en Cuenta (nombre de la comuna y de la categoría, y si
 * está visible), por cuenta. Se muestra al instante al entrar y se pone al
 * día por detrás: antes aparecían "Comuna", "Categoría" y sin "Visible" hasta
 * que llegaban las consultas.
 */
type Recordado = { comuna: string | null; categoria: string | null; visibilidad: { pausado: boolean; ocultoPorAdmin: boolean } | null };
const recordados = new Map<string, Recordado>();
const claveRecuerdo = (id: string) => `kheep:cuenta:${id}`;

export function PerfilComercio({ profile, email }: { profile: Perfil; email: string | undefined }) {
  const router = useRouter();
  const { refreshProfile } = useSession();
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [editando, setEditando] = useState<'nombre' | 'correo' | 'clave' | 'telefono' | null>(null);
  /**
   * Correo o contraseña en el editor: se recuerda aparte de `editando` para que
   * al cerrarse (mientras se desvanece) no vuelva a mostrar el correo.
   */
  const [modoAcceso, setModoAcceso] = useState<'correo' | 'clave'>('correo');
  useEffect(() => {
    if (editando === 'correo' || editando === 'clave') setModoAcceso(editando);
  }, [editando]);
  const [recuerdo, setRecuerdo] = useState<Recordado | null>(() => recordados.get(profile.id) ?? null);
  const [visibilidad, setVisibilidad] = useState<{ pausado: boolean; ocultoPorAdmin: boolean } | null>(
    () => recordados.get(profile.id)?.visibilidad ?? null,
  );
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [categoriasDeMiComuna, setCategoriasDeMiComuna] = useState<Categoria[]>([]);
  /** Elegir categoría: de qué comuna (la propia o la nueva a la que se cambia). */
  const [eligiendo, setEligiendo] = useState<{ comunaId: string; categorias: Categoria[] } | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Lo recordado de otras veces (también tras cerrar la app).
  useEffect(() => {
    if (recordados.has(profile.id)) return;
    AsyncStorage.getItem(claveRecuerdo(profile.id))
      .then((t) => {
        if (!t) return;
        const r = JSON.parse(t) as Recordado;
        recordados.set(profile.id, r);
        setRecuerdo(r);
        setVisibilidad((v) => v ?? r.visibilidad);
      })
      .catch(() => {});
  }, [profile.id]);

  useEffect(() => {
    fetchMiVisibilidad()
      .then((v) => setVisibilidad(v.disponible ? v : null))
      .catch(() => setVisibilidad(null));
    fetchComunas()
      .then(setComunas)
      .catch(() => setComunas([]));
  }, []);

  const cargarCategorias = useCallback(() => {
    if (!profile.comuna_id) return setCategoriasDeMiComuna([]);
    fetchCategorias(profile.comuna_id)
      .then(setCategoriasDeMiComuna)
      .catch(() => setCategoriasDeMiComuna([]));
  }, [profile.comuna_id]);
  useEffect(cargarCategorias, [cargarCategorias]);

  // Mientras llegan las listas, lo recordado; al llegar, lo de verdad.
  const comunaCargada = comunas.length > 0;
  const categoriasCargadas = categoriasDeMiComuna.length > 0;
  const nombreComuna = comunaCargada
    ? (comunas.find((c) => c.id === profile.comuna_id)?.nombre ?? null)
    : (recuerdo?.comuna ?? null);
  const nombreCategoria = categoriasCargadas
    ? (categoriasDeMiComuna.find((c) => c.id === profile.categoria_id)?.nombre ?? null)
    : (recuerdo?.categoria ?? null);

  // Se guarda lo que se ve, para la próxima vez.
  useEffect(() => {
    if (!comunaCargada || (profile.comuna_id && !categoriasCargadas)) return;
    const r: Recordado = { comuna: nombreComuna, categoria: nombreCategoria, visibilidad };
    recordados.set(profile.id, r);
    AsyncStorage.setItem(claveRecuerdo(profile.id), JSON.stringify(r)).catch(() => {});
  }, [profile.id, profile.comuna_id, comunaCargada, categoriasCargadas, nombreComuna, nombreCategoria, visibilidad]);

  async function cambiarFoto() {
    try {
      const foto = await pickAndCompressImage({ uso: 'logo' });
      if (!foto) return;
      setSubiendoFoto(true);
      const url = await uploadCompressedImage('logos', profile.id, foto, 'logo');
      await cambiarMiFoto(url);
      await refreshProfile();
    } catch (err) {
      Alert.alert('No se pudo cambiar la foto', getErrorMessage(err, 'Intenta de nuevo.'));
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function alternarVisible() {
    if (!visibilidad || visibilidad.ocultoPorAdmin) return;
    const antes = visibilidad;
    setVisibilidad({ ...antes, pausado: !antes.pausado });
    try {
      await pausarMiPerfil(!antes.pausado);
    } catch (err) {
      setVisibilidad(antes);
      Alert.alert('No se pudo guardar', getErrorMessage(err, 'Intenta de nuevo.'));
    }
  }

  /**
   * Elegida otra comuna: se cambia solo la comuna (la categoría se elige
   * después con su botón; si la nueva comuna tiene la de ahora, se mantiene).
   */
  function alElegirComuna(comunaId: string | null) {
    if (!comunaId || comunaId === profile.comuna_id) return;
    const destino = comunas.find((c) => c.id === comunaId)?.nombre ?? 'la nueva comuna';
    const mensaje = !profile.comuna_id
      ? `Tu comercio quedará en ${destino}. Después elige tu categoría con el botón rojo.`
      : `Tu comercio y todas tus publicaciones se mudarán a ${destino}. Si ${destino} no tiene tu categoría, elige otra con el botón rojo y tus publicaciones se moverán a ella.`;
    pedirConfirmacion(mensaje, () => cambiarMiNegocio(comunaId, null));
  }

  function alTocarCategoria() {
    if (!profile.comuna_id) {
      Alert.alert('Primero la comuna', 'Elige la comuna de tu comercio (el texto rojo de arriba).');
      return;
    }
    setEligiendo({ comunaId: profile.comuna_id, categorias: categoriasDeMiComuna });
  }

  /** Elegida una categoría con el botón rojo (de las de su comuna). */
  function confirmar(comunaId: string, categoria: Categoria) {
    if (categoria.id === profile.categoria_id) return;
    const mensaje = !profile.categoria_id
      ? `Tu categoría será ${categoria.nombre}.`
      : `Tu categoría será ${categoria.nombre} y todas tus publicaciones se moverán a ella.`;
    pedirConfirmacion(mensaje, () => cambiarMiNegocio(comunaId, categoria.id));
  }

  function pedirConfirmacion(mensaje: string, cambiar: () => Promise<void>) {
    Alert.alert('¿Confirmas el cambio?', `${mensaje}\n\nLos 3 primeros cambios son libres; después hay que esperar 7 días entre uno y otro.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cambiar',
        onPress: async () => {
          setGuardando(true);
          try {
            await cambiar();
            await refreshProfile();
          } catch (err) {
            Alert.alert('No se pudo cambiar', getErrorMessage(err, 'Intenta de nuevo.'));
          } finally {
            setGuardando(false);
          }
        },
      },
    ]);
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace('/(app)/(tabs)/dashboard');
  }

  /** Dos confirmaciones antes de borrar: no se puede deshacer. */
  function eliminarCuenta() {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrará tu cuenta con tu perfil, tus publicaciones y tus banners. Los banners pagados que sigan vigentes se pierden.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('¿Seguro?', 'Tu cuenta se elimina para siempre y no se puede recuperar.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar cuenta',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await eliminarMiCuenta();
                    router.replace('/(app)/(tabs)/dashboard');
                  } catch (err) {
                    Alert.alert('No se pudo eliminar', getErrorMessage(err, 'Intenta de nuevo.'));
                  }
                },
              },
            ]),
        },
      ],
    );
  }

  const oculto = visibilidad?.pausado || visibilidad?.ocultoPorAdmin;


  return (
    <View style={styles.pantalla}>
      <View style={styles.arriba}>
        <Pressable onPress={cambiarFoto} disabled={subiendoFoto} accessibilityRole="imagebutton" accessibilityLabel="Cambiar foto de perfil">
          {profile.logo_url ? (
            <FotoRemota uri={profile.logo_url} ancho={FOTO} style={[styles.foto, subiendoFoto && styles.atenuado]} />
          ) : (
            <View style={[styles.foto, styles.fotoVacia, subiendoFoto && styles.atenuado]} />
          )}
        </Pressable>

        {/* El nombre del comercio: tocarlo lo cambia (también en sus publicaciones). */}
        <Pressable onPress={() => setEditando('nombre')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Cambiar nombre">
          <TextoDeslizante texto={profile.nombre} style={styles.nombre} onPress={() => setEditando('nombre')} />
        </Pressable>

        {/* "Visible": tocarlo pausa el perfil (vacaciones, sin stock…) y
            vuelve a mostrarlo. Si lo ocultó un admin, solo se avisa. */}
        {visibilidad && (
          <Pressable
            onPress={() => void alternarVisible()}
            disabled={visibilidad.ocultoPorAdmin}
            style={({ pressed }) => [styles.visible, oculto && styles.oculto, pressed && styles.atenuado]}
            accessibilityRole="switch"
            accessibilityState={{ checked: !oculto }}>
            <Text style={[styles.visibleLabel, oculto && styles.ocultoLabel]}>
              {visibilidad.ocultoPorAdmin ? 'Suspendido' : oculto ? 'Oculto' : 'Visible'}
            </Text>
          </Pressable>
        )}

        {/* Tocar la palabra cambia entre el correo y la contraseña; tocar el
            dato abre su editor. */}
        {/* El correo: tocarlo abre su editor, y desde ahí se pasa a la contraseña. */}
        <Pressable
          onPress={() => {
            setModoAcceso('correo');
            setEditando('correo');
          }}
          hitSlop={6}
          style={styles.separarCorreo}
          accessibilityRole="button"
          accessibilityLabel="Cambiar correo o contraseña">
          <Text style={styles.correo} numberOfLines={1} adjustsFontSizeToFit>
            {email ?? '—'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEditando('telefono')}
          hitSlop={6}
          style={styles.separarTelefono}
          accessibilityRole="button"
          accessibilityLabel="Cambiar teléfono">
          <Text style={styles.telefono}>{telefonoLegible(profile.telefono_contacto)}</Text>
        </Pressable>
      </View>

      <View style={styles.abajo}>
        <View style={styles.botones}>
          {/* La comuna del comercio, en rojo: tocarla elige otra. */}
          <View style={[styles.centrado, styles.separarComuna]}>
            <ComunaPicker
              comunas={comunas}
              selectedId={profile.comuna_id}
              nombre={nombreComuna ?? 'Comuna'}
              onSelect={alElegirComuna}
              estiloEtiqueta={styles.comuna}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.boton, styles.botonRojo, (pressed || guardando) && styles.botonRojoPresionado]}
            onPress={alTocarCategoria}
            disabled={guardando}
            accessibilityRole="button">
            {/* Sin achicarse para caber: Android lo achicaba aunque cupiera y no
                quedaba del mismo tamaño que "Mis banners". */}
            <TextoDeslizante texto={nombreCategoria ?? 'Categoría'} style={styles.botonLabel} onPress={alTocarCategoria} />
          </Pressable>

          {/* "Mis banners": sus banners (publicarlos y verlos). */}
          <Pressable
            style={({ pressed }) => [styles.boton, styles.botonBorde, pressed && styles.atenuado]}
            onPress={() => router.push('/(app)/banner/mis')}
            accessibilityRole="button">
            <Text style={styles.botonLabel} numberOfLines={1}>
              Mis banners
            </Text>
          </Pressable>
        </View>

        {/* "Salir", centrado en el espacio bajo los botones: el mismo que
            "Cancelar" bajo "Guardar" en los editores (el alto de un botón). */}
        <View style={styles.pieSalir}>
          <Pressable onPress={salir} hitSlop={10} accessibilityRole="button">
            <Text style={styles.salir}>Salir</Text>
          </Pressable>
        </View>
        <Pressable onPress={eliminarCuenta} hitSlop={10} accessibilityRole="button" style={styles.eliminarCuenta}>
          <Text style={styles.eliminarCuentaLabel}>Eliminar cuenta</Text>
        </Pressable>
      </View>

      {/* Las categorías de su comuna, en la misma pantalla que elegir comuna:
          el nombre de la comuna arriba y su categoría de ahora en rojo. */}
      <ComunaPicker
        abierta={eligiendo !== null}
        onCerrar={() => setEligiendo(null)}
        subtitulo={nombreComuna ?? 'Categoría'}
        comunas={eligiendo?.categorias ?? []}
        selectedId={profile.categoria_id}
        sinResultados="No encontramos esa categoría."
        onSelect={(id) => {
          const elegida = eligiendo?.categorias.find((c) => c.id === id);
          if (eligiendo && elegida) confirmar(eligiendo.comunaId, elegida);
        }}
      />

      {/* Correo y contraseña en el mismo editor: "Contraseña" sobre Guardar
          pasa a cambiar la contraseña (y "Correo" vuelve). */}
      <EditorPantalla
        visible={editando === 'correo' || editando === 'clave'}
        subtitulo={modoAcceso === 'clave' ? 'Contraseña' : 'Correo'}
        placeholder={modoAcceso === 'clave' ? 'Contraseña nueva' : 'Correo'}
        inicial={modoAcceso === 'clave' ? '' : (email ?? '')}
        esClave={modoAcceso === 'clave'}
        propsCampo={modoAcceso === 'clave' ? undefined : { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false }}
        validar={(v) =>
          modoAcceso === 'clave'
            ? v.length >= 8
              ? null
              : 'Usa al menos 8 caracteres.'
            : isValidEmail(v)
              ? null
              : 'Escribe un correo válido.'
        }
        alternativa={{
          texto: modoAcceso === 'clave' ? 'Correo' : 'Contraseña',
          // "Correo" en gris; "Contraseña", en rojo.
          gris: modoAcceso === 'clave',
          onPress: () => setEditando((e) => (e === 'clave' ? 'correo' : 'clave')),
        }}
        onCerrar={() => setEditando(null)}
        onGuardar={async (v) => {
          if (modoAcceso === 'clave') {
            await cambiarMiClave(v);
            Alert.alert('Listo', 'Tu contraseña cambió.');
          } else {
            if (v.trim().toLowerCase() === (email ?? '').toLowerCase()) return;
            await cambiarMiCorreo(v);
            Alert.alert('Revisa tu correo', `Te enviamos un correo a ${v.trim()} para confirmar el cambio.`);
          }
        }}
      />
      <EditorPantalla
        visible={editando === 'nombre'}
        subtitulo="Nombre"
        placeholder="Nombre del negocio"
        inicial={profile.nombre}
        fuente={Fonts.medium}
        propsCampo={{ autoCapitalize: 'words', maxLength: 60 }}
        validar={(v) => (v.trim() ? null : 'Escribe el nombre de tu negocio.')}
        onCerrar={() => setEditando(null)}
        onGuardar={async (v) => {
          if (v.trim() === profile.nombre.trim()) return;
          await cambiarMiNombre(v);
          await refreshProfile();
        }}
      />
      <EditorPantalla
        visible={editando === 'telefono'}
        subtitulo="Teléfono"
        placeholder="912345678"
        inicial={celularConEspacios(celularLocal(profile.telefono_contacto))}
        formatear={celularConEspacios}
        propsCampo={{ keyboardType: 'number-pad', maxLength: 12 }}
        validar={(v) => (isValidChileanPhone(soloCelular(v)) ? null : MENSAJE_CELULAR)}
        onCerrar={() => setEditando(null)}
        onGuardar={async (v) => {
          await cambiarMiTelefono(normalizeChileanPhone(soloCelular(v)));
          await refreshProfile();
        }}
      />
    </View>
  );
}

const FOTO = 92;

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    justifyContent: 'space-between',
  },
  arriba: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centrado: {
    alignItems: 'center',
  },
  // Más aire: "Visible", correo, teléfono, y la comuna
  // sobre los botones. Se suman al espacio de siempre entre uno y otro.
  separarCorreo: {
    marginTop: Spacing.three,
  },
  separarTelefono: {
    marginTop: Spacing.two,
  },
  separarComuna: {
    marginBottom: Spacing.two,
  },
  foto: {
    width: FOTO,
    height: FOTO,
    borderRadius: FOTO / 2,
  },
  fotoVacia: {
    backgroundColor: '#D9D9D9',
  },
  atenuado: {
    opacity: 0.6,
  },
  nombre: {
    fontFamily: Fonts.medium,
    fontSize: 27,
    color: Colors.text,
    marginTop: Spacing.one,
  },
  // "Visible": cápsula roja; oculto, solo con borde. Medidas del diseño (en la
  // rejilla de 1000 de ancho): 278 x 83.
  // Al menos el ancho del diseño; con una palabra más larga
  // ("Suspendido") crece y deja su margen a los lados.
  visible: {
    minWidth: u(278),
    paddingHorizontal: Spacing.four,
    height: u(83),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  oculto: {
    backgroundColor: 'transparent',
    borderColor: Colors.textMuted,
  },
  visibleLabel: {
    fontFamily: Fonts.medium,
    fontSize: u(42),
    color: '#FFFFFF',
  },
  ocultoLabel: {
    color: Colors.textMuted,
  },
  // "Correo" / "Contraseña", chica y gris, al lado del dato.
  filaAcceso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    alignSelf: 'stretch',
    // Alto fijo: correo o contraseña, la fila mide lo mismo y el teléfono
    // de abajo no se mueve.
    height: 34,
  },
  // Del mismo tamaño que el dato (va en la misma línea), solo en gris.
  etiquetaAcceso: {
    color: Colors.textMuted,
  },
  datoAcceso: {
    flexShrink: 1,
  },
  correo: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    lineHeight: 32,
    color: Colors.text,
  },
  // Del mismo tamaño que el correo.
  telefono: {
    fontFamily: Fonts.light,
    fontSize: 22,
    lineHeight: 32,
    color: Colors.accent,
  },
  abajo: {
    alignItems: 'stretch',
    marginTop: Spacing.three,
  },
  // Más anchos que el resto: llegan hasta el margen
  // lateral de la pantalla, como "Publicar", saliéndose del relleno de la
  // tarjeta (Spacing.four).
  botones: {
    alignItems: 'stretch',
    gap: Spacing.two,
    marginHorizontal: u(REJILLA.margenLateral) - Spacing.four,
  },
  pieSalir: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La comuna, como el diseño: texto rojo grande y centrado.
  comuna: {
    fontFamily: Fonts.medium,
    fontSize: 23,
    lineHeight: 34,
    color: Colors.accent,
    textAlign: 'center',
  },
  boton: {
    height: 64,
    borderRadius: u(REJILLA.curvatura),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  botonRojo: {
    backgroundColor: Colors.accent,
  },
  botonRojoPresionado: {
    backgroundColor: Colors.accentPressed,
  },
  botonBorde: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  botonLabel: {
    fontFamily: Fonts.medium,
    fontSize: 23,
    color: '#FFFFFF',
  },
  salir: {
    fontFamily: Fonts.delgada,
    fontSize: 25,
    color: Colors.accent,
    textAlign: 'center',
  },
  // Más chico y en gris, bajo "Salir": se ve, pero no se toca por error.
  eliminarCuenta: {
    alignSelf: 'center',
    paddingBottom: Spacing.three,
  },
  eliminarCuentaLabel: {
    fontFamily: Fonts.delgada,
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
