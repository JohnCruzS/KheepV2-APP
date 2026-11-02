const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Firma la versión final de Android con la clave de subida de Google Play.
 *
 * La carpeta android/ se genera y no va en git, así que la firma se agrega
 * acá para que sobreviva a cada `expo prebuild`. Los datos de la clave no
 * están en el proyecto: se leen de las propiedades de Gradle del usuario
 * (~/.gradle/gradle.properties):
 *
 *   KHEEP_SUBIDA_ARCHIVO  ruta del archivo .keystore
 *   KHEEP_SUBIDA_ALIAS    nombre de la clave dentro del archivo
 *   KHEEP_SUBIDA_CLAVE    contraseña
 *
 * Sin esas propiedades, la versión final se firma con la clave de desarrollo,
 * que sirve para instalar en un teléfono pero Google Play rechaza.
 */
const FIRMA = `
        release {
            if (findProperty('KHEEP_SUBIDA_ARCHIVO')) {
                storeFile file(findProperty('KHEEP_SUBIDA_ARCHIVO'))
                storePassword findProperty('KHEEP_SUBIDA_CLAVE')
                keyAlias findProperty('KHEEP_SUBIDA_ALIAS')
                keyPassword findProperty('KHEEP_SUBIDA_CLAVE')
            }
        }`;

function agregarFirma(gradle) {
  if (gradle.includes('KHEEP_SUBIDA_ARCHIVO')) return gradle;
  // La firma nueva, junto a la de desarrollo.
  gradle = gradle.replace(/(signingConfigs \{\s*\n\s*debug \{[^}]*\})/, `$1${FIRMA}`);
  // La versión final la usa si está configurada.
  return gradle.replace(
    /(release \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/,
    "$1signingConfig findProperty('KHEEP_SUBIDA_ARCHIVO') ? signingConfigs.release : signingConfigs.debug",
  );
}

module.exports = function firmaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = agregarFirma(c.modResults.contents);
    return c;
  });
};

module.exports.agregarFirma = agregarFirma;
