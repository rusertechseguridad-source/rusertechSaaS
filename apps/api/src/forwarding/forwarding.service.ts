import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cifrarJson, CONTEXTO } from '../common/crypto/secretos-cifrados';

/** Lo que la fila tiene de credencial, sin la credencial. */
type FilaReenviador = { auth_credentials: unknown; [k: string]: unknown };

/**
 * Saca la credencial de la respuesta y deja en su lugar SI hay una.
 *
 * ⚠️ Es la mitad que no se puede saltear. Cifrar la columna protege la base;
 * si la API sigue devolviendo el valor, un `manager` lo lee desde la consola
 * del navegador y el cifrado no sirvió de nada. Y a diferencia de las
 * credenciales de `avl_users` —que existen para que una persona las copie—
 * ésta la usa el backend: nadie necesita verla.
 */
function sinCredencial<T extends FilaReenviador>(fila: T) {
  const { auth_credentials, ...resto } = fila;
  return { ...resto, tiene_credencial: auth_credentials !== null && auth_credentials !== undefined };
}

@Injectable()
export class ForwardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getForwarders(tenantId: string) {
    const filas = await this.prisma.positionForwarder.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });
    return filas.map(sinCredencial);
  }

  async createForwarder(tenantId: string, data: any) {
    return this.prisma.positionForwarder.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        target_url: data.target_url,
        auth_type: data.auth_type || 'none',
        // El bearer token de la integración del cliente. Se cifra al entrar:
        // quien lea la base —un backup, un dump, el panel de Supabase— no se
        // lleva las credenciales de las integraciones de todos los clientes.
        auth_credentials: cifrarJson(data.auth_credentials, CONTEXTO.forwarderAuthCredentials) ?? undefined,
        payload_format: data.payload_format || 'rusertech_v1',
        is_active: data.is_active ?? true
      }
    });
  }

  async getForwarder(tenantId: string, id: string) {
    const forwarder = await this.prisma.positionForwarder.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!forwarder) throw new NotFoundException('Forwarder no encontrado');
    return sinCredencial(forwarder);
  }

  /**
   * La fila COMPLETA, con la credencial cifrada. Sólo para el procesador.
   *
   * Separada de `getForwarder` a propósito: que la versión que sirve a la API
   * y la que usa el envío sean el mismo método es exactamente cómo una
   * credencial termina en una respuesta HTTP sin que nadie lo decida.
   */
  async getForwarderConCredencial(tenantId: string, id: string) {
    const forwarder = await this.prisma.positionForwarder.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!forwarder) throw new NotFoundException('Forwarder no encontrado');
    return forwarder;
  }

  async updateForwarder(tenantId: string, id: string, data: any) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: {
        name: data.name,
        target_url: data.target_url,
        auth_type: data.auth_type,
        // ⚠️ `undefined` y no `null` cuando no vienen credenciales: Prisma OMITE
        // las claves `undefined`, así que editar el nombre de un reenviador sin
        // reenviar la credencial la CONSERVA. Con `null` la borraría en
        // silencio, y el reenvío empezaría a fallar con 401 sin que nadie
        // hubiera pedido eso.
        auth_credentials:
          data.auth_credentials === undefined
            ? undefined
            : (cifrarJson(data.auth_credentials, CONTEXTO.forwarderAuthCredentials) ?? undefined),
        payload_format: data.payload_format,
        is_active: data.is_active
      }
    });
  }

  async deleteForwarder(tenantId: string, id: string) {
    return this.prisma.positionForwarder.delete({
      where: { id, tenant_id: tenantId }
    });
  }

  async toggleForwarder(tenantId: string, id: string, isActive: boolean) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: { is_active: isActive }
    });
  }

  async resetCircuit(tenantId: string, id: string) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: {
        circuit_open: false,
        circuit_opened_at: null,
        consecutive_failures: 0
      }
    });
  }

  async getStats(tenantId: string, id: string) {
    const forwarder = await this.getForwarder(tenantId, id);
    return {
      total_sent: forwarder.total_sent,
      total_failed: forwarder.total_failed,
      consecutive_failures: forwarder.consecutive_failures,
      circuit_open: forwarder.circuit_open,
      last_error: forwarder.last_error
    };
  }
}
