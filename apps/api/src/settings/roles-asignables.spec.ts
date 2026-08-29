import { evaluarCambioDeRol } from './roles-asignables';
import { ADMIN_ROLES } from '../common/constants/admin-roles';

/**
 * La escalada 🔴 del informe (§2.1), fijada como prueba: un `account_owner`
 * se asignaba `rusertech_admin`, volvía a entrar, y veía las 65 tablas de
 * todos los clientes. Ninguno de los tres pasos necesitaba un bug.
 */
describe('evaluarCambioDeRol', () => {
  const OWNER = 'usuario-propietario';
  const OTRO = 'usuario-editado';

  describe('roles de plataforma', () => {
    it.each([...ADMIN_ROLES])('niega asignar "%s" desde la configuración del cliente', (rol) => {
      const v = evaluarCambioDeRol({ rolSolicitado: rol, editorId: OWNER, objetivoId: OTRO });
      expect(v.permitido).toBe(false);
      expect(v).toMatchObject({ motivo: 'rol_de_plataforma' });
    });

    it('lo niega TAMBIÉN a quien ya es administrador de plataforma', () => {
      // La regla no tiene excepciones a propósito: para eso está
      // PUT /admin/users/:id, que es otro camino y pasa por checkSuperAdmin.
      // Una regla sin excepciones es una regla verificable.
      const v = evaluarCambioDeRol({
        rolSolicitado: 'rusertech_admin', editorId: 'un-admin', objetivoId: OTRO,
      });
      expect(v.permitido).toBe(false);
    });

    it('deja pasar los roles de cliente', () => {
      // Los códigos reales del seed, no inventados.
      for (const rol of ['account_owner', 'manager', 'operator', 'viewer', 'driver', 'gerencia', 'key_user']) {
        expect(evaluarCambioDeRol({ rolSolicitado: rol, editorId: OWNER, objetivoId: OTRO }))
          .toEqual({ permitido: true });
      }
    });
  });

  describe('auto-edición del propio rol', () => {
    it('niega que un usuario se cambie el rol a sí mismo', () => {
      const v = evaluarCambioDeRol({ rolSolicitado: 'manager', editorId: OWNER, objetivoId: OWNER });
      expect(v).toMatchObject({ permitido: false, motivo: 'auto_edicion_de_rol' });
    });

    it('el motivo del rol de plataforma gana sobre el de auto-edición', () => {
      // Que el mensaje sea el más específico importa: "no podés asignar ese
      // rol" explica más que "no podés editarte a vos mismo".
      const v = evaluarCambioDeRol({
        rolSolicitado: 'rusertech_admin', editorId: OWNER, objetivoId: OWNER,
      });
      expect(v).toMatchObject({ motivo: 'rol_de_plataforma' });
    });

    it('permite editarse a sí mismo mientras no toque el rol', () => {
      // Cambiarse el propio nombre es legítimo y no debe quedar bloqueado.
      expect(evaluarCambioDeRol({ editorId: OWNER, objetivoId: OWNER }))
        .toEqual({ permitido: true });
    });
  });

  describe('peticiones que no tocan el rol', () => {
    it.each([
      ['sin la clave', {}],
      ['con undefined', { rolSolicitado: undefined }],
      ['con null', { rolSolicitado: null }],
    ])('%s: no hay nada que evaluar', (_caso, solicitud) => {
      expect(evaluarCambioDeRol({ ...solicitud, editorId: OWNER, objetivoId: OTRO }))
        .toEqual({ permitido: true });
    });
  });

  describe('identificadores incompletos', () => {
    it('no inventa la auto-edición si falta el id del editor', () => {
      // Sin editorId no se puede AFIRMAR que sea auto-edición. La función no
      // adivina; que el dato llegue es responsabilidad del controller.
      expect(evaluarCambioDeRol({ rolSolicitado: 'manager', objetivoId: OTRO }))
        .toEqual({ permitido: true });
    });

    it('pero el rol de plataforma se niega igual, falten los ids que falten', () => {
      // Ésta es la que de verdad protege: no depende de ningún contexto.
      expect(evaluarCambioDeRol({ rolSolicitado: 'rusertech_admin' }))
        .toMatchObject({ permitido: false, motivo: 'rol_de_plataforma' });
    });
  });

  it('el mensaje nombra los roles de plataforma reales, no una lista escrita a mano', () => {
    const v = evaluarCambioDeRol({ rolSolicitado: 'rusertech_admin' });
    expect(v.permitido).toBe(false);
    if (!v.permitido) expect(v.detalle).toContain(ADMIN_ROLES.join(', '));
  });
});
