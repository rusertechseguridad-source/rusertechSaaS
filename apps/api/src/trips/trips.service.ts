import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

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
        speed: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).speed : null,
        address: evt.metadata_json && typeof evt.metadata_json === 'object' ? (evt.metadata_json as any).address : null,
      }));
    }

    return dto;
  }

  async findAll(tenantId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { tenant_id: tenantId },
      include: {
        vehicle: true,
        operation: true,
        origin_location: true,
        destination_location: true,
        route: true,
      },
      orderBy: { planned_start: 'desc' }
    });
    return trips.map(t => this.mapToDto(t));
  }

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        vehicle: true,
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
    return this.mapToDto(trip);
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
        vehicle: { connect: { id: data.vehicle_id } },
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
      updateData.vehicle = { connect: { id: data.vehicle_id } };
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
    return this.mapToDto(trip);
  }
}
