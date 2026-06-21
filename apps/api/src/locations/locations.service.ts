import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any) {
    let restrictions = undefined;
    if (user?.role === 'viewer') {
      const fullUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { entity_restrictions: true } });
      const er = fullUser?.entity_restrictions as any;
      if (er && Array.isArray(er.locations) && er.locations.length > 0) {
        restrictions = { id: { in: er.locations } };
      }
    }

    return this.prisma.extended.savedLocation.findMany({
      where: restrictions,
      include: {
        operation: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string) {
    const loc = await this.prisma.extended.savedLocation.findUnique({
      where: { id }
    });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async create(data: any, tenantId: string, userId: string) {
    const { name, address, location_type, lat, lng, radius_meters = 100, operation_id, is_authorized_stop, notes } = data;
    
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      throw new BadRequestException('Coordinates are required');
    }

    // Step 1: Insert with geometry using $executeRawUnsafe (no RETURNING to avoid geography deserialization)
    const safeName = String(name).replace(/'/g, "''");
    const safeAddress = address ? `'${String(address).replace(/'/g, "''")}'` : 'NULL';
    const safeLocType = String(location_type || 'generic').replace(/'/g, "''");

    const safeOperationId = operation_id ? `'${operation_id}'::uuid` : 'NULL';
    const safeNotes = notes ? `'${String(notes).replace(/'/g, "''")}'` : 'NULL';

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "saved_locations" (
        tenant_id, name, address, location_type, latitude, longitude, radius_meters, created_by, geometry, operation_id, is_authorized_stop, notes
      ) VALUES (
        '${tenantId}'::uuid, 
        '${safeName}', 
        ${safeAddress}, 
        '${safeLocType}', 
        ${lat}, 
        ${lng}, 
        ${radius_meters}, 
        '${userId}'::uuid, 
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${safeOperationId},
        ${is_authorized_stop ? 'true' : 'false'},
        ${safeNotes}
      );
    `);

    // Step 2: Fetch the just-created record via Prisma (avoids geography column)
    const created = await this.prisma.extended.savedLocation.findFirst({
      where: { name: name, tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });

    return created;
  }

  async update(id: string, data: any) {
    const { name, address, location_type, lat, lng, radius_meters, operation_id, is_authorized_stop, notes } = data;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (location_type) updateData.location_type = location_type;
    if (lat !== undefined) updateData.latitude = lat;
    if (lng !== undefined) updateData.longitude = lng;
    if (radius_meters !== undefined) updateData.radius_meters = radius_meters;
    if (operation_id !== undefined) updateData.operation_id = operation_id || null;
    if (is_authorized_stop !== undefined) updateData.is_authorized_stop = is_authorized_stop;
    if (notes !== undefined) updateData.notes = notes;

    const loc = await this.prisma.extended.savedLocation.update({
      where: { id },
      data: updateData
    });

    // Update geometry if coordinates changed
    if (lat !== undefined || lng !== undefined) {
      const rLat = loc.latitude;
      const rLng = loc.longitude;
      await this.prisma.$executeRawUnsafe(`
        UPDATE "saved_locations" 
        SET geometry = ST_SetSRID(ST_MakePoint(${rLng}, ${rLat}), 4326)::geography 
        WHERE id = '${id}'
      `);
    }

    return loc;
  }

  async remove(id: string) {
    return this.prisma.extended.savedLocation.delete({ where: { id } });
  }

  async toggleActive(id: string, isActive: boolean) {
    return this.prisma.extended.savedLocation.update({
      where: { id },
      data: { is_active: isActive }
    });
  }
}
