import { registerDecorator, ValidationOptions } from 'class-validator';
import { PERMISSION_KEYS } from '../constants/permissions';

/**
 * Cada elemento del arreglo tiene que ser un permiso QUE EXISTA en el catálogo.
 *
 * Por qué importa, y no es cosmético: un permiso inventado no da acceso hoy
 * —`PermissionsGuard` compara strings exactos— pero **tampoco se nota**. Queda
 * guardado en `granted_permissions` y el día que alguien cree un permiso con
 * ese nombre, el usuario lo hereda sin que nadie lo haya decidido. Es el mismo
 * mecanismo por el que un rol llamado `super_admin` daba acceso total antes de
 * la Fase E.
 *
 * El catálogo es `SYSTEM_PERMISSIONS`, la fuente única: acá no se escribe
 * ninguna lista.
 */
export function SonPermisosDelCatalogo(opciones?: ValidationOptions): PropertyDecorator {
  return function (objeto: object, propiedad: string | symbol) {
    registerDecorator({
      name: 'sonPermisosDelCatalogo',
      target: objeto.constructor,
      propertyName: propiedad as string,
      options: opciones,
      validator: {
        validate(valor: unknown) {
          if (!Array.isArray(valor)) return false;
          return valor.every((p) => typeof p === 'string' && (PERMISSION_KEYS as string[]).includes(p));
        },
        defaultMessage(args) {
          const recibidos = Array.isArray(args?.value) ? args.value : [];
          const desconocidos = recibidos.filter(
            (p) => typeof p !== 'string' || !(PERMISSION_KEYS as string[]).includes(p),
          );
          return desconocidos.length
            ? `${args?.property}: estos permisos no existen en el catálogo: ${desconocidos.join(', ')}`
            : `${args?.property} debe ser una lista de permisos del catálogo`;
        },
      },
    });
  };
}
