import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * FILTRO GLOBAL DE EXCEPCIONES.
 *
 * Por qué existe: hasta esta tanda no había ninguno. Un fallo de Prisma llegaba
 * al cliente como un 500 mudo —"Internal server error"— y al log como un volcado
 * sin tenant, sin usuario y sin ruta. Con eso, un error reportado por un cliente
 * no se podía ubicar: no había forma de saber a qué tenant le pasó.
 *
 * Tres reglas:
 *
 *   1. **Los errores conocidos de Prisma se traducen.** Un `P2002` es un
 *      conflicto de unicidad: eso es un 409, no un 500. El cliente puede actuar
 *      sobre un 409 ("ya existe una patente igual"); sobre un 500 no.
 *   2. **El detalle interno NO viaja al cliente.** El mensaje de Prisma nombra
 *      tablas, columnas e índices: es un mapa del esquema. Al cliente le va un
 *      texto en su idioma; el detalle queda en el log.
 *   3. **No se traga nada.** Lo inesperado sigue siendo 500 —cambiarlo sería
 *      mentir sobre la gravedad— pero se registra con todo lo necesario para
 *      encontrarlo: tenant, usuario, método, ruta y el stack completo.
 */
@Catch()
export class FiltroDeExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const respuesta = ctx.getResponse<Response>();
    const peticion = ctx.getRequest<Request>();

    const { estado, mensaje, detalleInterno, cuerpoPropio, esperado } = this.traducir(excepcion);

    // El contexto que faltaba. `usuario` y `tenant` salen de req.user, que pone
    // JwtStrategy; en una ruta sin token quedan como 'anónimo', que también es
    // información útil.
    const usuario = (peticion as any)?.user ?? {};
    const contexto =
      `${peticion?.method} ${(peticion as any)?.originalUrl ?? peticion?.url} · ` +
      `tenant=${usuario.tenantId ?? 'anónimo'} usuario=${usuario.id ?? 'anónimo'}`;

    if (esperado) {
      // 4xx: es una petición mal formada o un conflicto de datos, no una falla
      // del sistema. Va como warn y en una línea: llenar el log de stacks por
      // cada 404 esconde los errores que sí importan.
      this.logger.warn(`${estado} ${contexto} — ${detalleInterno ?? mensaje}`);
    } else {
      this.logger.error(`${estado} ${contexto} — ${detalleInterno ?? mensaje}`);
      if (excepcion instanceof Error && excepcion.stack) {
        this.logger.error(excepcion.stack);
      }
    }

    if (cuerpoPropio) {
      // `statusCode` se agrega igual para que la forma no cambie entre una
      // respuesta con cuerpo propio y una genérica, pero sin pisar nada de lo
      // que el handler puso.
      respuesta.status(estado).json({ statusCode: estado, ...cuerpoPropio });
      return;
    }

    respuesta.status(estado).json({
      statusCode: estado,
      message: mensaje,
      path: (peticion as any)?.originalUrl ?? peticion?.url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ¿El cuerpo de la excepción lo armó un handler, o es el genérico de Nest?
   *
   * El genérico son exactamente `statusCode`, `message` y `error`. Cualquier
   * clave fuera de esas tres significa que alguien puso información ahí a
   * propósito, y tirarla sería descartar justo lo que quiso decir.
   */
  private esCuerpoPropio(cuerpo: unknown): boolean {
    if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return false;
    const genericas = new Set(['statusCode', 'message', 'error']);
    return Object.keys(cuerpo).some((clave) => !genericas.has(clave));
  }

  private traducir(excepcion: unknown): {
    estado: number;
    mensaje: string | string[];
    detalleInterno?: string;
    cuerpoPropio?: Record<string, unknown>;
    esperado: boolean;
  } {
    // Las excepciones de Nest ya traen su código y su mensaje, y son las que usan
    // los servicios para decir "no encontrado" o "no autorizado". Se respetan tal
    // cual: reinterpretarlas rompería, entre otras cosas, el 409 con el
    // inventario de dependencias que devuelve `trips.remove()`.
    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      const cuerpo = excepcion.getResponse();
      const mensaje =
        typeof cuerpo === 'string'
          ? cuerpo
          : ((cuerpo as any)?.message ?? excepcion.message);

      // ⚠️ CUERPO ESTRUCTURADO: se devuelve TAL CUAL, sin aplanarlo.
      //
      // Encontrado arrancando el binario compilado, no leyendo el código. Con
      // la base caída, `GET /health` devolvía el 503 correcto pero con el
      // cuerpo genérico de este filtro: "Service Unavailable Exception". O sea
      // que el diagnóstico —qué dependencia falló, con qué error y en cuántos
      // milisegundos— se perdía EXACTAMENTE cuando hace falta.
      //
      // El criterio general: si un handler se tomó el trabajo de armar un
      // objeto como cuerpo de su excepción, ese objeto ES la respuesta. Sólo
      // se aplana cuando el cuerpo es la forma por defecto de Nest
      // (`{ statusCode, message, error }`), donde no hay nada propio que
      // conservar. Esto también preserva el 409 con el inventario de
      // dependencias de `trips.remove()`, que hasta ahora perdía todo menos
      // `message` pese a que el comentario de arriba decía lo contrario.
      if (this.esCuerpoPropio(cuerpo)) {
        return { estado, mensaje, cuerpoPropio: cuerpo as Record<string, unknown>,
                 esperado: estado < HttpStatus.INTERNAL_SERVER_ERROR };
      }

      return { estado, mensaje, esperado: estado < HttpStatus.INTERNAL_SERVER_ERROR };
    }

    if (excepcion instanceof Prisma.PrismaClientKnownRequestError) {
      return this.traducirPrisma(excepcion);
    }

    // Un cuerpo que no tiene la forma que el esquema espera llega como error de
    // validación de Prisma. Es culpa del cliente, así que 400 y no 500.
    if (excepcion instanceof Prisma.PrismaClientValidationError) {
      return {
        estado: HttpStatus.BAD_REQUEST,
        mensaje: 'Los datos enviados no tienen la forma que esta operación espera.',
        detalleInterno: excepcion.message.split('\n').slice(-3).join(' ').trim(),
        esperado: true,
      };
    }

    return {
      estado: HttpStatus.INTERNAL_SERVER_ERROR,
      mensaje: 'Error interno del servidor.',
      detalleInterno: excepcion instanceof Error ? excepcion.message : String(excepcion),
      esperado: false,
    };
  }

  private traducirPrisma(error: Prisma.PrismaClientKnownRequestError): {
    estado: number;
    mensaje: string;
    detalleInterno: string;
    esperado: boolean;
  } {
    const meta = error.meta ?? {};
    const detalleInterno = `Prisma ${error.code}: ${error.message.replace(/\s+/g, ' ').trim()}`;

    switch (error.code) {
      case 'P2002': {
        // Violación de unicidad. `meta.target` trae las columnas del índice: se
        // nombran porque el usuario necesita saber QUÉ campo repitió, y son
        // datos que él mismo acaba de escribir — no filtran nada del esquema.
        const campos = Array.isArray(meta.target) ? meta.target.join(', ') : undefined;
        return {
          estado: HttpStatus.CONFLICT,
          mensaje: campos
            ? `Ya existe un registro con ese valor en: ${campos}.`
            : 'Ya existe un registro con esos datos.',
          detalleInterno,
          esperado: true,
        };
      }

      case 'P2025':
        // El registro a modificar o borrar no existe. Mismo criterio que
        // `assertTenantOwnership`: 404 y no 403, para no confirmar que el UUID
        // exista en otro tenant.
        return {
          estado: HttpStatus.NOT_FOUND,
          mensaje: 'El registro solicitado no existe.',
          detalleInterno,
          esperado: true,
        };

      case 'P2003':
        // Clave foránea. Puede ser que apunte a algo inexistente, o que la fila
        // tenga hijos que la sostienen. Las dos son un conflicto de estado.
        return {
          estado: HttpStatus.CONFLICT,
          mensaje:
            'La operación afecta a otros registros relacionados. ' +
            'Verificá que las referencias existan y que no queden registros dependientes.',
          detalleInterno,
          esperado: true,
        };

      case 'P2000':
        return {
          estado: HttpStatus.BAD_REQUEST,
          mensaje: 'Uno de los valores enviados es más largo de lo que admite el campo.',
          detalleInterno,
          esperado: true,
        };

      default:
        // Un código de Prisma que todavía no mapeamos NO se disfraza de 4xx:
        // sigue siendo 500, y se registra con su código para poder agregarlo.
        return {
          estado: HttpStatus.INTERNAL_SERVER_ERROR,
          mensaje: 'Error interno del servidor.',
          detalleInterno: `${detalleInterno} · código de Prisma sin mapear`,
          esperado: false,
        };
    }
  }
}
