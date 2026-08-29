import { ArgumentsHost, ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FiltroDeExcepciones } from './excepciones.filter';

/**
 * Antes de esta tanda no había filtro: un fallo de Prisma llegaba al cliente
 * como un 500 mudo y al log sin tenant, sin usuario y sin ruta. Con eso, un
 * error reportado por un cliente no se podía ubicar.
 */
describe('FiltroDeExcepciones', () => {
  let filtro: FiltroDeExcepciones;
  let json: jest.Mock, status: jest.Mock;
  let logWarn: jest.SpyInstance, logError: jest.SpyInstance;

  const host = (peticion: any = {}): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'PUT', originalUrl: '/api/v1/vehicles/x', ...peticion }),
      }),
    }) as any;

  const prismaError = (code: string, meta?: any) =>
    new Prisma.PrismaClientKnownRequestError('mensaje interno con nombres de tablas', {
      code, clientVersion: '6.19.3', meta,
    });

  beforeEach(() => {
    filtro = new FiltroDeExcepciones();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    logWarn = jest.spyOn((filtro as any).logger, 'warn').mockImplementation(() => {});
    logError = jest.spyOn((filtro as any).logger, 'error').mockImplementation(() => {});
  });

  describe('los códigos de Prisma que el encargo pide mapear', () => {
    it('P2002 (unicidad) → 409, nombrando el campo repetido', () => {
      filtro.catch(prismaError('P2002', { target: ['tenant_id', 'plate'] }), host());
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(json.mock.calls[0][0].message).toContain('tenant_id, plate');
    });

    it('P2025 (no existe) → 404', () => {
      filtro.catch(prismaError('P2025'), host());
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('P2003 (clave foránea) → 409', () => {
      filtro.catch(prismaError('P2003'), host());
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });
  });

  it('🔴 el mensaje interno de Prisma NUNCA llega al cliente', () => {
    // El texto de Prisma nombra tablas, columnas e índices: es un mapa del
    // esquema. Va al log; al cliente le va un texto en su idioma.
    filtro.catch(prismaError('P2002', { target: ['plate'] }), host());
    const cuerpo = JSON.stringify(json.mock.calls[0][0]);
    expect(cuerpo).not.toContain('mensaje interno con nombres de tablas');
    expect(logWarn.mock.calls[0][0]).toContain('mensaje interno con nombres de tablas');
  });

  it('🔴 un código de Prisma sin mapear NO se disfraza de 4xx', () => {
    // Bajarlo a 4xx sería mentir sobre la gravedad. Sigue siendo 500 y se
    // registra con su código para poder agregarlo después.
    filtro.catch(prismaError('P9999'), host());
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(logError.mock.calls[0][0]).toContain('sin mapear');
  });

  it('registra tenant, usuario, método y ruta — el contexto que faltaba', () => {
    filtro.catch(prismaError('P2002'), host({
      user: { id: 'usuario-9', tenantId: 'tenant-7' },
    }));
    const linea = logWarn.mock.calls[0][0];
    expect(linea).toContain('tenant=tenant-7');
    expect(linea).toContain('usuario=usuario-9');
    expect(linea).toContain('PUT /api/v1/vehicles/x');
  });

  it('en una ruta sin token deja constancia de que fue anónima', () => {
    filtro.catch(prismaError('P2025'), host());
    expect(logWarn.mock.calls[0][0]).toContain('tenant=anónimo');
  });

  describe('lo que NO debe tocar', () => {
    it('respeta las HttpException de los servicios tal cual', () => {
      // `trips.remove()` devuelve un 409 con el inventario de dependencias:
      // reinterpretarlo rompería esa respuesta, que costó una tanda entera.
      filtro.catch(new ConflictException({ message: 'Tiene 3 eventos asociados', bloqueos: 3 }), host());
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(json.mock.calls[0][0].message).toBe('Tiene 3 eventos asociados');
    });

    it('un 404 de servicio sigue siendo 404 y va como warn, no como error', () => {
      filtro.catch(new NotFoundException('Vehículo no encontrado'), host());
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(logError).not.toHaveBeenCalled();
      expect(logWarn).toHaveBeenCalled();
    });
  });

  it('un error inesperado sigue siendo 500 y se registra con su stack', () => {
    // No se traga nada: lo desconocido conserva su gravedad.
    filtro.catch(new Error('algo que nadie previó'), host());
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0].message).toBe('Error interno del servidor.');
    expect(logError.mock.calls.some((c) => String(c[0]).includes('at '))).toBe(true);
  });

  it('la respuesta siempre trae ruta y momento, para poder cruzarla con el log', () => {
    filtro.catch(new Error('x'), host());
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 500, path: '/api/v1/vehicles/x',
    });
    expect(json.mock.calls[0][0].timestamp).toEqual(expect.any(String));
  });
});
