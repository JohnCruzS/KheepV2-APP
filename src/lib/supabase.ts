import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y completa los valores de tu proyecto Supabase.',
  );
}

// AsyncStorage guarda la sesión (access/refresh token) en el dispositivo.
// Es el adaptador que Supabase recomienda oficialmente para Expo/React Native.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * La cuenta con la sesión abierta, leída del teléfono (sin ir al servidor).
 * `supabase.auth.getUser()` le pregunta al servidor cada vez (~0,25 s) y se
 * usaba antes de cada guardado: publicar un banner hacía dos viajes de más.
 * Es seguro porque quien decide qué se puede hacer es la base (sus reglas
 * validan el token en cada consulta), no este dato.
 */
export async function usuarioActual() {
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}
