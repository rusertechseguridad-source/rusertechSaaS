import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CarbonService } from '../carbon/carbon.service';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService, private carbonService: CarbonService) {}

  private mapToDto(trip: any) {
    if (!trip) return null;
    const dto = {
      ...trip,
      scheduled_start: trip.planned_start,
      scheduled_end: trip.planned_end,
    };

    if (trip.trip_events) {
      dto.events = trip.trip_events.map((evt: any) => ({
        id: evt.id,
        generated_at: evt.timestamp,
        event_name: evt.event_type,
        lat: evt.latitude,
        lng: evt.longitude,
        speed: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).speed : null,
        address: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).address : null,
        temperature_c: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).temperature_c : null,
        humidity_pct: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).humidity_pct : null,
      }));
    }

    return dto;
  }

  async findAll(user: any) {
    let restrictions = undefined;
    if (user?.role === 'viewer') {
      const fullUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { entity_restrictions: true } });
      const er = fullUser?.entity_restrictions as any;
      if (er && Array.isArray(er.vehicles) && er.vehicles.length > 0) {
        restrictions = { vehicle_id: { in: er.vehicles } };
      }
    }

    const trips = await this.prisma.trip.findMany({
      where: { 
        tenant_id: user.tenantId,
        ...restrictions
      },
      include: {
        vehicle: {
          include: { avl_user: true, carrier: true }
        },
        carrier: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
        trip_events: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { planned_start: 'desc' }
    });
    return trips.map(t => this.mapToDto(t));
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        vehicle: {
          include: { avl_user: true, carrier: true }
        },
        carrier: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
        trip_events: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    if (!trip) throw new NotFoundException('Trip not found');
    
    const dto = this.mapToDto(trip) as any;
    
    if (trip.route_id && dto.route) {
      const geo: any = await this.prisma.$queryRawUnsafe(`
        SELECT ST_AsGeoJSON(geometry) as geojson FROM "routes" WHERE id = '${trip.route_id}'
      `);
      if (geo && geo[0] && geo[0].geojson) {
        dto.route.geojson = JSON.parse(geo[0].geojson);
      }
    }
    
    return dto;
  }

  async create(data: any, tenantId: string, userId: string) {
    let origin_name = null;
    let origin_address = null;
    let origin_lat = null;
    let origin_lng = null;
    if (data.origin_location_id) {
      const loc = await this.prisma.savedLocation.findUnique({
        where: { id: data.origin_location_id }
      });
      if (loc) {
        origin_name = loc.name;
        origin_address = loc.address;
        origin_lat = loc.latitude;
        origin_lng = loc.longitude;
      }
    }

    let destination_name = null;
    let destination_address = null;
    let destination_lat = null;
    let destination_lng = null;
    if (data.destination_location_id) {
      const loc = await this.prisma.savedLocation.findUnique({
        where: { id: data.destination_location_id }
      });
      if (loc) {
        destination_name = loc.name;
        destination_address = loc.address;
        destination_lat = loc.latitude;
        destination_lng = loc.longitude;
      }
    }

    const planned_start = new Date(data.scheduled_start);
    const planned_end = data.scheduled_end 
      ? new Date(data.scheduled_end) 
      : new Date(planned_start.getTime() + 24 * 60 * 60 * 1000);

    const trip = await this.prisma.trip.create({
      data: {
        name: data.name || '',
        trip_code: data.trip_code || null,
        status: data.status || 'PROGRAMADO',
        planned_start,
        planned_end,
        vehicle: data.vehicle_id ? { connect: { id: data.vehicle_id } } : undefined,
        carrier: data.carrier_id ? { connect: { id: data.carrier_id } } : undefined,
        operation: data.operation_id ? { connect: { id: data.operation_id } } : undefined,
        origin_location: data.origin_location_id ? { connect: { id: data.origin_location_id } } : undefined,
        destination_location: data.destination_location_id ? { connect: { id: data.destination_location_id } } : undefined,
        route: data.route_id ? { connect: { id: data.route_id } } : undefined,
        tenant: { connect: { id: tenantId } },
        created_by: { connect: { id: userId } },
        origin_name,
        origin_address,
        origin_lat,
        origin_lng,
        destination_name,
        destination_address,
        destination_lat,
        destination_lng,
      },
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    return this.mapToDto(trip);
  }

  async update(id: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.trip_code !== undefined) updateData.trip_code = data.trip_code;
    if (data.status !== undefined) updateData.status = data.status;
    
    if (data.scheduled_start !== undefined) {
      updateData.planned_start = new Date(data.scheduled_start);
    }
    if (data.scheduled_end !== undefined) {
      updateData.planned_end = data.scheduled_end ? new Date(data.scheduled_end) : undefined;
    }
    if (data.actual_start !== undefined) {
      updateData.actual_start = data.actual_start ? new Date(data.actual_start) : null;
    }
    if (data.actual_end !== undefined) {
      updateData.actual_end = data.actual_end ? new Date(data.actual_end) : null;
    }

    if (data.vehicle_id !== undefined) {
      updateData.vehicle = data.vehicle_id ? { connect: { id: data.vehicle_id } } : { disconnect: true };
    }
    if (data.carrier_id !== undefined) {
      updateData.carrier = data.carrier_id ? { connect: { id: data.carrier_id } } : { disconnect: true };
    }
    if (data.operation_id !== undefined) {
      updateData.operation = data.operation_id ? { connect: { id: data.operation_id } } : { disconnect: true };
    }
    if (data.route_id !== undefined) {
      updateData.route = data.route_id ? { connect: { id: data.route_id } } : { disconnect: true };
    }

    if (data.origin_location_id !== undefined) {
      updateData.origin_location = data.origin_location_id ? { connect: { id: data.origin_location_id } } : { disconnect: true };
      if (data.origin_location_id) {
        const loc = await this.prisma.savedLocation.findUnique({
          where: { id: data.origin_location_id }
        });
        if (loc) {
          updateData.origin_name = loc.name;
          updateData.origin_address = loc.address;
          updateData.origin_lat = loc.latitude;
          updateData.origin_lng = loc.longitude;
        }
      } else {
        updateData.origin_name = null;
        updateData.origin_address = null;
        updateData.origin_lat = null;
        updateData.origin_lng = null;
      }
    }

    if (data.destination_location_id !== undefined) {
      updateData.destination_location = data.destination_location_id ? { connect: { id: data.destination_location_id } } : { disconnect: true };
      if (data.destination_location_id) {
        const loc = await this.prisma.savedLocation.findUnique({
          where: { id: data.destination_location_id }
        });
        if (loc) {
          updateData.destination_name = loc.name;
          updateData.destination_address = loc.address;
          updateData.destination_lat = loc.latitude;
          updateData.destination_lng = loc.longitude;
        }
      } else {
        updateData.destination_name = null;
        updateData.destination_address = null;
        updateData.destination_lat = null;
        updateData.destination_lng = null;
      }
    }

    const trip = await this.prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    if (updateData.status === 'FINALIZADO' && trip.vehicle_id) {
      await this.carbonService.dispatchFinalCalculation(trip.id, trip.vehicle_id, trip.tenant_id);
    }

    return this.mapToDto(trip);
  }

  async remove(id: string) {
    return this.prisma.trip.delete({
      where: { id }
    });
  }

  async updateStatus(id: string, data: { status: string, notes?: string }) {
    const updateData: any = { status: data.status };
    if (data.status === 'EN_CURSO') {
      updateData.actual_start = new Date();
    } else if (data.status === 'FINALIZADO') {
      updateData.actual_end = new Date();
    }
    if (data.notes) {
      updateData.notes = data.notes;
    }
    const trip = await this.prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      }
    });

    if (data.status === 'FINALIZADO' && trip.vehicle_id) {
      await this.carbonService.dispatchFinalCalculation(trip.id, trip.vehicle_id, trip.tenant_id);
    }

    return this.mapToDto(trip);
  }

  async getLogs(id: string) {
    return this.prisma.eventLog.findMany({
      where: {
        trip_id: id,
        event_type: 'operator_log',
      },
      orderBy: { triggered_at: 'desc' },
      include: {
        acknowledger: {
          select: { full_name: true, email: true }
        }
      }
    });
  }

  async addLog(id: string, text: string, user: any) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { tenant_id: true, vehicle_id: true }
    });
    if (!trip) throw new Error('Trip not found');
    if (!trip.vehicle_id) throw new Error('Trip must have a vehicle to add logs');

    return this.prisma.eventLog.create({
      data: {
        tenant_id: trip.tenant_id,
        vehicle_id: trip.vehicle_id,
        trip_id: id,
        event_type: 'operator_log',
        severity: 'info',
        status: 'open',
        acknowledged_by: user.id,
        metadata_json: { note: text }
      },
      include: {
        acknowledger: {
          select: { full_name: true, email: true }
        }
      }
    });
  }

  // --- LINKED VEHICLES ---

  async getLinkedVehicles(tripId: string) {
    return this.prisma.tripLinkedVehicle.findMany({
      where: { trip_id: tripId },
      include: {
        vehicle: true,
      },
      orderBy: { linked_at: 'asc' }
    });
  }

  async linkVehicle(tripId: string, vehicleId: string, linkType: string = 'support', notes?: string) {
    const existing = await this.prisma.tripLinkedVehicle.findFirst({
      where: { trip_id: tripId, vehicle_id: vehicleId }
    });

    if (existing) {
      throw new BadRequestException('El vehículo ya está enlazado a este viaje.');
    }

    // Get vehicle to link its device if it has one
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    return this.prisma.tripLinkedVehicle.create({
      data: {
        trip_id: tripId,
        vehicle_id: vehicleId,
        link_type: linkType,
        notes: notes || null
      },
      include: {
        vehicle: true
      }
    });
  }

  async unlinkVehicle(tripId: string, vehicleId: string) {
    await this.prisma.tripLinkedVehicle.deleteMany({
      where: {
        trip_id: tripId,
        vehicle_id: vehicleId
      }
    });
    return { success: true };
  }
}
