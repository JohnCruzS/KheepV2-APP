import { EditorPantalla } from '@/components/admin/EditorPantalla';
import { isValidEmail } from '@/lib/validation';

/** Cambiar el correo con el que entra una cuenta del panel, a pantalla completa. */
export function CambiarCorreo({
  visible,
  actual,
  onCerrar,
  onGuardar,
}: {
  visible: boolean;
  /** De quién es (no se muestra: la pantalla solo tiene el campo). */
  para?: string;
  /** El correo de ahora, para no guardar si no cambió. */
  actual: string;
  onCerrar: () => void;
  onGuardar: (correo: string) => Promise<void>;
}) {
  return (
    <EditorPantalla
      visible={visible}
      subtitulo="Correo"
      placeholder="Nuevo correo"
      // Arranca con el correo de ahora, para corregirlo sin reescribirlo.
      inicial={actual}
      propsCampo={{ keyboardType: 'email-address' }}
      validar={(valor) => (isValidEmail(valor.trim()) ? null : 'Escribe un correo válido.')}
      onCerrar={onCerrar}
      onGuardar={async (valor) => {
        const correo = valor.trim().toLowerCase();
        if (correo === actual.trim().toLowerCase()) return;
        await onGuardar(correo);
      }}
    />
  );
}
