import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';

import { Text } from '@/components/ui/Texto';
import { Colors } from '@/constants/theme';

/**
 * Campo de una línea con el texto y el cursor SIEMPRE al centro. Android, con
 * un campo centrado, deja el cursor al final cuando
 * está vacío (sobre todo con el teclado numérico o tras borrar todo), y
 * ningún ajuste del campo lo arregla en todos los teléfonos.
 *
 * Por eso el campo de verdad ocupa todo el ancho pero no se ve (recibe el
 * teclado y el texto), y encima va el texto centrado con un cursor propio que
 * parpadea justo después de lo escrito, solo mientras se escribe.
 *
 * `autoFocus` abre el teclado con un pequeño retraso: dentro de una ventana
 * a pantalla completa, Android ignora el foco si se pide al instante.
 */
export function CampoCentrado({
  value,
  style,
  autoFocus,
  onFocus,
  onBlur,
  ...props
}: Omit<TextInputProps, 'style'> & { value: string; style?: StyleProp<TextStyle> }) {
  const campo = useRef<TextInput>(null);
  const [enfocado, setEnfocado] = useState(false);
  /** Ancho disponible para el texto y ancho que ocupa a su tamaño normal. */
  const [disponible, setDisponible] = useState(0);
  const [natural, setNatural] = useState(0);
  const parpadeo = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => campo.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [autoFocus]);

  useEffect(() => {
    if (!enfocado) return;
    parpadeo.setValue(1);
    const animacion = Animated.loop(
      Animated.sequence([
        Animated.timing(parpadeo, { toValue: 0, duration: 450, delay: 300, useNativeDriver: true }),
        Animated.timing(parpadeo, { toValue: 1, duration: 0, delay: 300, useNativeDriver: true }),
      ]),
    );
    animacion.start();
    return () => animacion.stop();
  }, [enfocado, parpadeo]);

  const visible = props.secureTextEntry ? '•'.repeat(value.length) : value;
  const plano = StyleSheet.flatten(style) ?? {};
  const base = plano.fontSize ?? 19;
  // Un texto largo (un correo) se achica lo justo para caber, hasta 3/4 de su
  // tamaño. Se calcula acá y no con `adjustsFontSizeToFit`: en Android ese
  // achica la letra pero deja la caja del tamaño original, así que el cursor
  // quedaba lejos de la última letra y el texto se veía más arriba.
  const escala = natural > 0 && disponible > 0 ? Math.max(0.75, Math.min(1, (disponible - HOLGURA) / natural)) : 1;
  const tamano = Math.floor(base * escala * 10) / 10;
  const alto = tamano * 1.35;

  return (
    // Tocar en cualquier parte del campo (y un poco alrededor, el resto de la
    // cápsula) abre el teclado, también después de cerrarlo tocando afuera.
    <Pressable style={styles.caja} onPress={() => campo.current?.focus()} hitSlop={{ top: 20, bottom: 20 }} accessible={false}>
      <TextInput
        {...props}
        ref={campo}
        value={value}
        caretHidden
        // Se escribe siempre al final, donde se dibuja el cursor: tocar a un
        // lado del campo lo ponía al inicio y lo escrito entraba adelante.
        selection={{ start: value.length, end: value.length }}
        selectionColor="transparent"
        onFocus={(e) => {
          setEnfocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setEnfocado(false);
          onBlur?.(e);
        }}
        style={[style, styles.invisible]}
      />
      {/* Mide el texto a su tamaño normal, sin límite de ancho (no se ve). */}
      <View style={styles.medidor} pointerEvents="none">
        <Text style={[style, styles.medida]} numberOfLines={1} onLayout={(e) => setNatural(e.nativeEvent.layout.width)}>
          {visible}
        </Text>
      </View>
      <View
        style={styles.encima}
        pointerEvents="none"
        onLayout={(e) => setDisponible(e.nativeEvent.layout.width - ANCHO_CURSOR)}>
        <Text
          style={[style, styles.texto, { fontSize: tamano, lineHeight: alto }]}
          numberOfLines={1}
          ellipsizeMode="head">
          {visible}
        </Text>
        {enfocado && <Animated.View style={[styles.cursor, { height: alto, opacity: parpadeo }]} />}
      </View>
    </Pressable>
  );
}

/** El cursor y su separación de la última letra. */
const ANCHO_CURSOR = 3;
/** Unos puntos de margen: justo al límite, Android redondea y corta con "…". */
const HOLGURA = 6;

const styles = StyleSheet.create({
  medidor: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 5000,
    opacity: 0,
    flexDirection: 'row',
  },
  // Sin estirarse (algún estilo de afuera trae `flex: 1`): mide solo el texto.
  medida: {
    flex: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    textAlign: 'left',
  },
  // Llena su cápsula (en fila o en columna): toda ella responde al toque y el
  // texto tiene todo el ancho.
  caja: {
    flexGrow: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  // Sin `flex` de afuera (el nombre de categoría trae `flex: 1`): dentro de
  // esta caja lo dejaba con alto cero y no había dónde tocar para escribir.
  invisible: {
    flex: 0,
    flexGrow: 0,
    flexBasis: 'auto',
    color: 'transparent',
    textAlign: 'center',
  },
  encima: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Del ancho de lo escrito (un `flex: 1` de afuera lo dejaba en cero o lo
  // estiraba, y el cursor quedaba lejos).
  texto: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cursor: {
    width: 2,
    marginLeft: 1,
    backgroundColor: Colors.accent,
  },
});
