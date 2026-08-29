import { evaluarAcceso, ESTADO_ACTIVO } from './estado-cuenta';

/**
 * La regla vive en un solo lugar justamente porque se consulta desde dos:
 * al emitir el token (`AuthService.validateUser`) y en cada request con un
 * token ya emitido (`JwtStrategy.validate`). Estas pruebas fijan la regla.
 */
describe('evaluarAcceso', () => {
  const activo = { estadoUsuario: ESTADO_ACTIVO, estadoTenant: ESTADO_ACTIVO };

  it('permite al usuario activo de un tenant activo', () => {
    expect(evaluarAcceso(activo)).toEqual({ permitido: true });
  });

  describe('niega al usuario que no está activo', () => {
    // Los tres valores que el sistema escribe hoy en `users.status`: el botón
    // de suspender guarda 'suspended', y el resto vienen de datos históricos.
    it.each(['suspended', 'inactive', 'pending', ''])(
      'status = "%s"',
      (estadoUsuario) => {
        expect(evaluarAcceso({ ...activo, estadoUsuario })).toEqual({
          permitido: false,
          motivo: estadoUsuario === '' ? 'sin_datos' : 'usuario_inactivo',
        });
      },
    );
  });

  it('niega al usuario activo cuyo TENANT está suspendido', () => {
    // Ésta es la mitad que el informe marcó como nunca leída: `tenants.status`
    // se escribía desde `suspendTenant` y no se consultaba en ningún punto.
    expect(evaluarAcceso({ ...activo, estadoTenant: 'suspended' })).toEqual({
      permitido: false,
      motivo: 'tenant_inactivo',
    });
  });

  it('prioriza el motivo del usuario cuando ambos están inactivos', () => {
    expect(
      evaluarAcceso({ estadoUsuario: 'suspended', estadoTenant: 'suspended' }),
    ).toEqual({ permitido: false, motivo: 'usuario_inactivo' });
  });

  describe('falla CERRADO ante datos ausentes', () => {
    // Un `undefined` acá significa que la consulta no trajo lo esperado —por
    // ejemplo, un usuario borrado entre la emisión del token y el request—.
    // En una comprobación de acceso eso se niega, no se deja pasar.
    it.each([
      ['sin estado de usuario', { estadoUsuario: undefined, estadoTenant: ESTADO_ACTIVO }],
      ['sin estado de tenant', { estadoUsuario: ESTADO_ACTIVO, estadoTenant: undefined }],
      ['ambos nulos', { estadoUsuario: null, estadoTenant: null }],
      ['usuario inexistente', { estadoUsuario: undefined, estadoTenant: undefined }],
    ])('%s', (_caso, estado) => {
      expect(evaluarAcceso(estado)).toEqual({ permitido: false, motivo: 'sin_datos' });
    });
  });

  it('distingue mayúsculas: "Active" NO es "active"', () => {
    // La columna es VarChar libre, sin CHECK. Si algún día entra un valor con
    // otra capitalización, se niega el acceso en vez de aceptarlo por descuido.
    expect(evaluarAcceso({ ...activo, estadoUsuario: 'Active' })).toEqual({
      permitido: false,
      motivo: 'usuario_inactivo',
    });
  });
});
