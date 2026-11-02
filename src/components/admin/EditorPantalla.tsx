import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { BotonPie } from '@/components/ui/BotonPie';
import { CampoCentrado } from '@/components/ui/CampoCentrado';
import { EncabezadoMarca } from '@/components/ui/EncabezadoMarca';
import { Text } from '@/components/ui/Texto';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { REJILLA, u } from '@/lib/rejilla';

/**
 * Editor de un solo dato a pantalla completa, con el mismo diseño que el de
 * las categorías: el título de la app con lo que se
 * edita debajo ("Correo", "Contraseña"), un único campo en cápsula al centro
 * —sin texto de ejemplo, con el cursor al centro— y, abajo, "Guardar" en rojo
 * y "Cancelar" en texto rojo.
 *
 * Arranca con el dato de ahora (`inicial`) para editarlo; la contraseña, que
 * no se puede mostrar, arranca vacía.
 */
export function EditorPantalla({
  visible,
  subtitulo,
  placeholder,
  inicial = '',
  propsCampo,
  esClave,
  alternativa,
  formatear,
  fuente,
  validar,
  onCerrar,
  onGuardar,
}: {
  visible: boolean;
  /** Lo que va bajo el título: "Correo", "Contraseña". */
  subtitulo: string;
  placeholder: string;
  /** Con lo que arranca escrito el campo. */
  inicial?: string;
  propsCampo?: TextInputProps;
  /** Campo de contraseña: con el ojo para ver lo que se escribe. */
  esClave?: boolean;
  /** Devuelve el error a mostrar, o null si está bien. */
  validar: (valor: string) => string | null;
  onCerrar: () => void;
  onGuardar: (valor: string) => Promise<void>;
  /** Un texto sobre "Guardar" que cambia a editar otra cosa (por ejemplo, del correo a la contraseña). */
  alternativa?: { texto: string; onPress: () => void; gris?: boolean };
  /** Cómo se muestra lo escrito mientras se escribe (por ejemplo, el teléfono con espacios). */
  formatear?: (valor: string) => string;
  /**
   * La fuente del texto tal como se ve fuera del editor (por ejemplo, el
   * nombre del negocio va en Medium). Sin ella, Light, como casi todo.
   */
  fuente?: string;
}) {
  const estiloCampo = fuente ? [styles.campo, { fontFamily: fuente }] : styles.campo;
  const [valor, setValor] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  useEffect(() => {
    if (visible) {
      setValor(inicial);
      setVerClave(false);
      setError(null);
    }
  }, [visible, inicial]);

  async function guardar() {
    const problema = validar(valor);
    if (problema) return setError(problema);
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(valor);
      onCerrar();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="none" onRequestClose={onCerrar}>
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <EncabezadoMarca subtitulo={subtitulo} />
        <KeyboardAvoidingView style={styles.cuerpo} behavior="padding">
          {/* El campo, en cápsula y centrado en el espacio libre. El espacio
              como texto de ejemplo deja el cursor al centro (Android lo
              pondría al final). */}
          <View style={styles.centro}>
            <View style={styles.capsula}>
              {/* La contraseña también va con el texto y el cursor al centro (el
                  campo nativo, vacío, deja el cursor al final); el ojo, a la
                  derecha, muestra lo que se escribe. */}
              {esClave ? (
                <>
                  <View style={styles.conOjo}>
                    <CampoCentrado
                      value={valor}
                      onChangeText={setValor}
                      secureTextEntry={!verClave}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={estiloCampo}
                      autoFocus
                      accessibilityLabel={placeholder}
                    />
                  </View>
                  <Pressable
                    style={styles.ojo}
                    onPress={() => setVerClave((v) => !v)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    <Ionicons name={verClave ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textMuted} />
                  </Pressable>
                </>
              ) : (
                <CampoCentrado
                  value={valor}
                  onChangeText={(v) => setValor(formatear ? formatear(v) : v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={estiloCampo}
                  autoFocus
                  accessibilityLabel={placeholder}
                  {...propsCampo}
                />
              )}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {alternativa ? (
            <Pressable onPress={alternativa.onPress} hitSlop={10} style={styles.alternativa} accessibilityRole="button">
              <Text style={[styles.alternativaTexto, alternativa.gris && styles.alternativaGris]}>{alternativa.texto}</Text>
            </Pressable>
          ) : null}
          <BotonPie
            label={guardando ? 'Guardando…' : 'Guardar'}
            onPress={guardar}
            cargando={guardando}
            debajo={{ texto: 'Cancelar', onPress: onCerrar }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alternativa: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  // Como "Cancelar": mismo tamaño, en rojo.
  alternativaTexto: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.accent,
  },
  alternativaGris: {
    color: Colors.textMuted,
  },
  pantalla: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cuerpo: {
    flex: 1,
  },
  centro: {
    flex: 1,
    marginHorizontal: u(REJILLA.margenLateral),
    justifyContent: 'center',
  },
  // La cápsula del editor de categorías: borde blanco, bien redondeada.
  capsula: {
    justifyContent: 'center',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    height: 66,
  },
  // Light y algo más grande, en la línea del resto de la app.
  campo: {
    fontFamily: Fonts.delgada,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  // El mismo aire a los dos lados, para que el texto siga al centro y no
  // quede debajo del ojo.
  conOjo: {
    marginHorizontal: Spacing.five,
  },
  ojo: {
    position: 'absolute',
    right: Spacing.four,
  },
  error: {
    fontFamily: Fonts.delgada,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  abajo: {
    paddingBottom: Spacing.three,
  },
  cancelar: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  // "Cancelar" en Poppins Light rojo, como "Salir" y "Nuevo".
  cancelarTexto: {
    fontFamily: Fonts.delgada,
    fontSize: 25,
    color: Colors.accent,
  },
});
