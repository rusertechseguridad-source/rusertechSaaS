import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.extended.savedLocation.findMany({
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
    const { name, address, location_type, lat, lng, radius_meters = 100 } = data;
    
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      throw new BadRequestException('Coordinates are required');
    }

    // Step 1: Insert with geometry using $executeRawUnsafe (no RETURNING to avoid geography deserialization)
    const safeName = String(name).replace(/'/g, "''");
    const safeAddress = address ? `'${String(address).replace(/'/g, "''")}'` : 'NULL';
    const safeLocType = String(location_type || 'generic').replace(/'/g, "''");

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "saved_locations" (
        tenant_id, name, address, location_type, latitude, longitude, radius_meters, created_by, geometry
      ) VALUES (
        '${tenantId}'::uuid, 
        '${safeName}', 
        ${safeAddress}, 
        '${safeLocType}', 
        ${lat}, 
        ${lng}, 
        ${radius_meters}, 
        '${userId}'::uuid, 
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
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
    const { name, address, location_type, lat, lng, radius_meters } = data;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (location_type) updateData.location_type = location_type;
    if (lat !== undefined) updateData.latitude = lat;
    if (lng !== undefined) updateData.longitude = lng;
    if (radius_meters !== undefined) updateData.radius_meters = radius_meters;

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
