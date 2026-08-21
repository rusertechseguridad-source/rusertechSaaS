import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MobileService {
  constructor(private prisma: PrismaService) {}

  async login(documentId: string, plate: string, activationCode: string, ipAddress: string, userAgent?: string) {
    // 1. Normalizar documentId y plate
    const docId = documentId.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const plt = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Rate Limiting Checks
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Bloqueo 15 min tras 10 fallos recientes
    const recentFailures = await this.prisma.mobileLoginAttempt.count({
      where: {
        ip_address: ipAddress,
        success: false,
        created_at: { gte: fifteenMinAgo }
      }
    });
    if (recentFailures >= 10) {
      throw new HttpException({ error: 'rate_limited', message: 'Demasiados intentos, intentá en 15 minutos' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Rate limit por IP (10/min)
    const ipAttempts = await this.prisma.mobileLoginAttempt.count({
      where: { ip_address: ipAddress, created_at: { gte: oneMinAgo } }
    });
    if (ipAttempts >= 10) {
      throw new HttpException({ error: 'rate_limited', message: 'Demasiados intentos, intentá en 1 minuto' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Rate limit por doc+plate (5/5min)
    const docPlateAttempts = await this.prisma.mobileLoginAttempt.count({
      where: { document_id: docId, plate: plt, created_at: { gte: fiveMinAgo } }
    });
    if (docPlateAttempts >= 5) {
      throw new HttpException({ error: 'rate_limited', message: 'Demasiados intentos, intentá en 5 minutos' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Proceso de Login
    try {
      // 2. Buscar driver
      const driver = await this.prisma.driver.findFirst({ where: { document: docId } });
      if (!driver) {
        await this.logAttempt(ipAddress, docId, plt, false, 'driver_not_found', userAgent);
        throw new NotFoundException({ error: 'driver_or_vehicle_not_found', message: 'Documento o patente no encontrados' });
      }

      // 4. Buscar vehicle
      const vehicle = await this.prisma.vehicle.findFirst({ where: { plate: plt, tenant_id: driver.tenant_id } });
      if (!vehicle) {
        await this.logAttempt(ipAddress, docId, plt, false, 'vehicle_not_found_or_tenant_mismatch', userAgent);
        throw new ForbiddenException({ error: 'driver_vehicle_mismatch', message: 'Conductor y vehículo no pertenecen al mismo operador' });
      }

      // 6. Buscar activation_code
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const codes = await this.prisma.mobileActivationCode.findMany({
        where: {
          driver_id: driver.id,
          OR: [ { vehicle_id: vehicle.id }, { vehicle_id: null } ],
          revoked_at: null,
          expires_at: { gt: now }
        }
      });

      let matchedCode = null;
      for (const code of codes) {
        if (code.used_at && code.used_at < twentyFourHoursAgo) continue; // Expiró la ventana de relogin
        const isValid = await bcrypt.compare(activationCode, code.code_hash);
        if (isValid) {
          matchedCode = code;
          break;
        }
      }

      if (!matchedCode) {
        await this.logAttempt(ipAddress, docId, plt, false, 'invalid_or_expired_code', userAgent);
        throw new UnauthorizedException({ error: 'invalid_or_expired_code', message: 'Código inválido o expirado' });
      }

      // 8. Match exitoso
      if (!matchedCode.used_at) {
        await this.prisma.mobileActivationCode.update({
          where: { id: matchedCode.id },
          data: { used_at: now }
        });
      }

      // Buscar avl_user "Rusertech_Mobile"
      const avlUser = await this.prisma.avlUser.findFirst({
        where: { tenant_id: driver.tenant_id, user_avl_code: 'Rusertech_Mobile' }
      });

      if (!avlUser) {
        // En teoría siempre debería existir por los scripts de seed
        await this.logAttempt(ipAddress, docId, plt, false, 'avl_user_not_found', userAgent);
        throw new HttpException('Configuración del tenant incompleta', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await this.logAttempt(ipAddress, docId, plt, true, null, userAgent);

      return {
        avlUserCode: avlUser.user_avl_code,
        apiKey: avlUser.api_key,
        driverId: driver.id,
        vehicleId: vehicle.id,
        driverName: driver.full_name,
        tenantId: driver.tenant_id
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      await this.logAttempt(ipAddress, docId, plt, false, 'internal_error', userAgent);
      throw new HttpException('Error interno', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async logAttempt(ip: string, docId: string, plate: string, success: boolean, reason: string | null, userAgent?: string) {
    try {
      await this.prisma.mobileLoginAttempt.create({
        data: {
          ip_address: ip,
          document_id: docId,
          plate: plate,
          success,
          failure_reason: reason,
          user_agent: userAgent
        }
      });
    } catch (e) {
      console.error('Failed to log mobile login attempt', e);
    }
  }

  async getActiveTrip(tenantId: string, vehicleId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        tenant_id: tenantId,
        vehicle_id: vehicleId,
        status: { in: ['assigned', 'in_progress', 'en_route', 'active'] }
      },
      orderBy: { created_at: 'desc' }
    });

    if (!trip) return null;

    return {
      tripId: trip.id,
      status: trip.status,
      origin: { address: trip.origin_address, lat: trip.origin_lat, lng: trip.origin_lng },
      destination: { address: trip.destination_address, lat: trip.destination_lat, lng: trip.destination_lng },
      cargoType: (trip as any).metadata_json?.cargoType || 'general',
      notes: trip.notes,
      createdAt: trip.created_at,
      createdFrom: (trip as any).metadata_json?.createdFrom || 'mobile_app'
    };
  }

  async createTrip(tenantId: string, userId: string, body: any) {
    const { driverId, vehicleId, origin, destination, cargoType, notes } = body;

    // Verificar si ya hay viaje activo
    const existing = await this.prisma.trip.findFirst({
      where: {
        tenant_id: tenantId,
        vehicle_id: vehicleId,
        status: { in: ['assigned', 'in_progress', 'en_route', 'active'] }
      }
    });

    if (existing) {
      throw new HttpException({ error: 'active_trip_exists', tripId: existing.id }, HttpStatus.CONFLICT);
    }

    const trip = await this.prisma.trip.create({
      data: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        origin_address: origin?.address,
        origin_lat: origin?.lat,
        origin_lng: origin?.lng,
        destination_address: destination?.address,
        destination_lat: destination?.lat,
        destination_lng: destination?.lng,
        notes,
        status: 'in_progress', // asumimos activo
        planned_start: new Date(),
        planned_end: new Date(),
        metadata_json: {
          createdFrom: 'mobile_app',
          cargoType: cargoType || 'general',
          source: 'mobile'
        }
      }
    });

    // TODO: Emitir Socket.io 'trip.created'
    return {
      tripId: trip.id,
      status: trip.status,
      createdAt: trip.created_at,
      createdFrom: 'mobile_app'
    };
  }

  async completeTrip(tenantId: string, tripId: string, body: any) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.tenant_id !== tenantId) throw new NotFoundException('Trip not found');

    if (['completed', 'cancelled'].includes(trip.status)) {
      return { tripId: trip.id, status: trip.status, completedAt: trip.actual_end };
    }

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'completed',
        actual_end: body.completedAt ? new Date(body.completedAt) : new Date(),
        notes: body.completedNotes ? `${trip.notes || ''}\n[Mobile]: ${body.completedNotes}` : trip.notes
      }
    });

    // TODO: Emitir Socket.io 'trip.completed'
    return {
      tripId: updated.id,
      status: updated.status,
      completedAt: updated.actual_end
    };
  }
}
