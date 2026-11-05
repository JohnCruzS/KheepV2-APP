import { Redirect, Stack, useSegments } from 'expo-router';

import { Colors } from '@/constants/theme';
import { puede } from '@/lib/administradores';
import { useSession } from '@/providers/SessionProvider';

/** Pantallas del panel que solo ve el administrador general. */
const SOLO_GENERAL = ['logos', 'administradores', 'administrador', 'precios-banner', 'limpieza'];
/** Pantallas que piden el permiso de banners (el general lo tiene siempre). */
const CON_BANNERS = ['banners', 'banner-nuevo', 'metricas'];

/**
 * Todas las pantallas del panel de administración pasan por aquí, también si
 * se abren con un enlace directo: un comerciante vuelve al inicio, y un
 * administrador de zona que no tiene acceso a una pantalla vuelve a su panel.
 * Es lo mismo que muestra el panel en sus opciones; la base de datos, además,
 * rechaza cualquier cambio fuera de los permisos de cada uno.
 */
export default function AdminLayout() {
  const { session, profile, permisos, isLoading } = useSession();
  const segmentos = useSegments() as string[];
  const pantalla = segmentos[segmentos.indexOf('admin') + 1];

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return null;
  if (profile.rol !== 'admin' && profile.rol !== 'admin_zona') return <Redirect href="/(app)/(tabs)/dashboard" />;

  if (permisos) {
    const permitida = SOLO_GENERAL.includes(pantalla)
      ? permisos.esGeneral
      : CON_BANNERS.includes(pantalla)
        ? puede(permisos, 'banners')
        : pantalla === 'moderacion'
          ? puede(permisos, 'moderar')
          : true;
    if (!permitida) return <Redirect href="/(app)/(tabs)/perfil" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: Colors.background } }} />;
}
