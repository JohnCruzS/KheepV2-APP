import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Texto';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PanelGeneral } from '@/components/admin/PanelGeneral';
import { PerfilComercio } from '@/components/perfil/PerfilComercio';
import { AjusteAPantalla } from '@/components/ui/AjusteAPantalla';
import { EncabezadoMarca } from '@/components/ui/EncabezadoMarca';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/providers/SessionProvider';

/**
 * Tercera pestaña. Su contenido depende de quién entra:
 *
 *  - Admin: el panel de administración general (título de la app, aprobar
 *    publicaciones, banners y métricas). Su propia cuenta está dentro, en "Mi
 *    cuenta": para un admin, administrar es lo que hace a diario y sus datos
 *    personales, lo que mira una vez.
 *  - Comerciante: su perfil de siempre — datos, editar y publicar banner.
 *
 * Sin sesión no llega a abrirse: el toque en la pestaña se intercepta en el
 * layout y abre el login (ver `listeners.tabPress`). El `null` de abajo es
 * solo una red de seguridad para el instante entre cerrar sesión y salir de
 * aquí; navegar durante el render es lo que hacía crashear con <Redirect>.
 */
export default function PerfilScreen() {
  const { session, profile, isLoading, refreshProfile } = useSession();

  if (!session) {
    return <View style={styles.safeArea} />;
  }

  // Hay sesión pero no se pudo cargar el perfil (sin conexión, por ejemplo):
  // se dice y se ofrece reintentar, en vez de dejar la pantalla vacía.
  if (!profile) {
    return (
      <View style={[styles.safeArea, styles.centrado]}>
        {isLoading ? null : (
          <>
            <Text style={styles.sinPerfilTitulo}>No pudimos cargar tu perfil</Text>
            <Text style={styles.sinPerfilTexto}>Revisa tu conexión a internet e inténtalo de nuevo.</Text>
            <View style={styles.reintentar}>
              <Button label="Reintentar" variant="secondary" onPress={refreshProfile} />
            </View>
          </>
        )}
      </View>
    );
  }

  if (profile.rol === 'admin' || profile.rol === 'admin_zona') {
    return <PanelGeneral />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EncabezadoMarca subtitulo="Cuenta" />

      {/* Todo en una vista, sin deslizar: si no cabe, se achica por igual lo
          justo para que quepa; si cabe, se ve con su tamaño real. */}
      <View style={styles.card}>
        <AjusteAPantalla style={styles.cardContent} llenar>
          <PerfilComercio profile={profile} email={session.user.email} />
        </AjusteAPantalla>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  sinPerfilTitulo: {
    fontFamily: Fonts.medium,
    fontSize: 19,
    color: Colors.text,
    textAlign: 'center',
  },
  sinPerfilTexto: {
    fontFamily: Fonts.light,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  reintentar: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  // Ocupa toda la pantalla: así los botones de abajo (comuna, categoría,
  // "Mis banners", "Salir") quedan abajo, como el diseño.
  cardContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
});
