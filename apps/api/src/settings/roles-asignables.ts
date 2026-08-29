import { ForbiddenException, Logger } from '@nestjs/common';
import { ADMIN_ROLES, isAdminRole } from '../common/constants/admin-roles';

/**
 * QUÉ ROL SE PUEDE ASIGNAR, EN CUALQUIER RUTA QUE ESCRIBA `role_code`.
 *
 * ⚠️ CORRECCIÓN DE LA TANDA 3. La primera versión de este archivo decía que la
 * regla valía "desde la configuración del cliente", y se enchufó en UN
 * controller. Gustavo verificó en producción que la escalada seguía abierta:
 * asignó "Admin Master" desde el panel y guardó sin un solo 400 ni 403.
 *
 * El diagnóstico, medido: **hay TRES rutas que escriben `role_code` y la regla
 * cubría UNA.**
 *
 *   1. `PUT  /api/v1/settings/users/:id`   → settings.service.updateUser
 *   2. `POST /api/v1/settings/users/invite` → settings.service.inviteUser   ← la peor
 *   3. `PUT  /api/v1/admin/users/:id`      → admin.service.updateUser       ← la que usó Gustavo
 *
 * La (2) es la más grave de las tres y no la había visto nadie: un
 * `account_owner` no necesita editarse a sí mismo — **invita a un usuario nuevo
 * con `rusertech_admin` y entra con esa cuenta.** Misma escalada, otro verbo.
 *
 * Es exactamente el patrón que este mismo informe nombró como la tesis de toda
 * la auditoría —"la protección está escrita, está bien escrita, y está
 * enchufada en 1 de cada N lugares donde hace falta"— y lo repetí yo.
 *
 * ── LAS DOS REGLAS ────────────────────────────────────────────────────────
 *
 *   1. **Un rol de plataforma no se asigna por HTTP. Por ninguna ruta.**
 *      Ni desde la configuración del cliente ni desde el panel de
 *      administración, y ni siquiera si quien pregunta ya es administrador de
 *      plataforma. Otorgar `rusertech_admin` pasa a ser una operación
 *      deliberada de SQL, igual que el resto de los cambios privilegiados de
 *      este proyecto. Una regla sin excepciones es la única que se puede
 *      verificar de un vistazo; la versión con excepciones fue la que falló.
 *
 *   2. **Nadie edita su propio `role_code`.** Ni un administrador. Un cambio
 *      de rol lo hace otra persona; promoverse a uno mismo no tiene caso de
 *      uso legítimo y es la forma exacta de la escalada.
 *
 * La lista NO se escribe acá: sale de `ADMIN_ROLES`, la fuente única. El
 * informe ya encontró que el frontend reimplementa esa lógica con strings
 * viejos (`SUPERADMIN`, `super_admin`); una copia más sería el mismo error.
 *
 * ⚠️ Si hace falta un camino en la aplicación para dar de alta personal de
 * Rusertech, es una decisión de producto y necesita su propio mecanismo con un
 * segundo factor explícito. Hoy no existe, y esta regla lo dice en voz alta en
 * vez de dejar una puerta abierta por si acaso.
 */

export type VeredictoRol =
  | { permitido: true }
  | { permitido: false; motivo: 'rol_de_plataforma' | 'auto_edicion_de_rol'; detalle: string };

export interface SolicitudCambioRol {
  /** `role_code` pedido en el cuerpo. `undefined` = la petición no toca el rol. */
  rolSolicitado?: string | null;
  /** `id` del usuario autenticado que hace el cambio. */
  editorId?: string | null;
  /** `id` del usuario que se está editando (el `:id` de la ruta). */
  objetivoId?: string | null;
}

export function evaluarCambioDeRol(solicitud: SolicitudCambioRol): VeredictoRol {
  const { rolSolicitado, editorId, objetivoId } = solicitud;

  // Una petición que no manda `role_code` no cambia ningún rol: no hay nada que
  // evaluar. `full_name` o `entity_restrictions` solos pasan sin ruido.
  if (rolSolicitado === undefined || rolSolicitado === null) {
    return { permitido: true };
  }

  if (isAdminRole(rolSolicitado)) {
    return {
      permitido: false,
      motivo: 'rol_de_plataforma',
      detalle:
        `El rol "${rolSolicitado}" es de administración de la plataforma y no se ` +
        `asigna desde la configuración del cliente. Roles de plataforma: ` +
        `${ADMIN_ROLES.join(', ')}.`,
    };
  }

  // Se compara sólo cuando los dos identificadores existen: si falta alguno no
  // se puede afirmar que sea auto-edición, y esta función no inventa el caso.
  // Que el `editorId` llegue es responsabilidad del controller.
  if (editorId && objetivoId && editorId === objetivoId) {
    return {
      permitido: false,
      motivo: 'auto_edicion_de_rol',
      detalle: 'Un usuario no puede cambiar su propio rol. Pedíselo a otro administrador.',
    };
  }

  return { permitido: true };
}

const registro = new Logger('RolesAsignables');

/**
 * Aplica la regla y corta con 403 si no pasa. Es la forma en que la usan los
 * servicios: poner el `if` en cada llamador fue exactamente el error que dejó
 * dos de las tres rutas sin cubrir.
 *
 * El intento se registra SIEMPRE, aunque el usuario no llegue a ver nada raro:
 * alguien pidiendo `rusertech_admin` es algo que hay que poder encontrar en el
 * log después, no sólo rechazar en el momento.
 */
export function exigirRolAsignable(solicitud: SolicitudCambioRol, contexto: string): void {
  const veredicto = evaluarCambioDeRol(solicitud);
  if (veredicto.permitido) return;

  registro.warn(
    `${contexto}: rechazado por ${veredicto.motivo}. ` +
      `rol="${solicitud.rolSolicitado}" editor=${solicitud.editorId ?? '?'} ` +
      `objetivo=${solicitud.objetivoId ?? '?'}`,
  );
  throw new ForbiddenException(veredicto.detalle);
}
