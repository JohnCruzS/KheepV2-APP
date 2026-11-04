const { AndroidConfig, withAndroidColors, withAndroidStyles } = require('expo/config-plugins');

/**
 * El color de acento de Android: el de los botones de los avisos del sistema
 * (Alert), los cursores y los controles nativos. Es el rojo de la marca, el
 * mismo de `Colors.accent` en src/constants/theme.ts.
 *
 * La carpeta android/ se genera y no va en git, así que el color se define acá
 * para que sobreviva a cada `expo prebuild`.
 */
const ROJO = '#D90804';

module.exports = function colorAcento(config) {
  config = withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'colorAccent', value: ROJO });
    return c;
  });
  return withAndroidStyles(config, (c) => {
    c.modResults = AndroidConfig.Styles.assignStylesValue(c.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'colorAccent',
      value: '@color/colorAccent',
    });
    return c;
  });
};
