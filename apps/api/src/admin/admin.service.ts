import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer'; // We need to install this

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        created_at: true,
        _count: {
          select: { vehicles: true, users: true }
        }
      }
    });
  }

  async getTenantStats(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const vehicles = await this.prisma.vehicle.count({ where: { tenant_id: id } });
    const activeTrips = await this.prisma.trip.count({ where: { tenant_id: id, status: { in: ['planned', 'in_progress'] } } });
    const openAlerts = await this.prisma.eventLog.count({ where: { tenant_id: id, status: 'active' } });
    
    return { vehicles, activeTrips, openAlerts };
  }

  async createTenant(data: { name: string; slug: string; plan: string; adminEmail: string; adminFullName: string }) {
    // Validar slug
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('El slug del tenant ya existe.');
    
    // Generar password temporal
    const tempPassword = crypto.randomBytes(4).toString('hex') + 'Aa1!';
    const hash = await bcrypt.hash(tempPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          plan: data.plan,
          status: 'active'
        }
      });

      // 3. Crear usuario account_owner
      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          email: data.adminEmail,
          full_name: data.adminFullName,
          password_hash: hash,
          role_code: 'account_owner',
          status: 'active'
        }
      });

      // 4. Crear configuración de huella de carbono
      await tx.carbonSetting.create({
        data: {
          tenant_id: tenant.id,
          use_climatiq_api: false
        }
      });

      return { tenant, user, tempPassword };
    });

    // 5. Enviar email de bienvenida
    await this.sendWelcomeEmail(result.user.email, result.user.full_name || '', data.slug, result.tempPassword);

    return {
      message: 'Tenant creado exitosamente',
      tenantId: result.tenant.id,
      adminEmail: result.user.email
    };
  }

  async suspendTenant(id: string, suspend: boolean) {
    return this.prisma.tenant.update({
      where: { id },
      data: { status: suspend ? 'suspended' : 'active' },
      select: { id: true, name: true, status: true }
    });
  }

  async updateTenant(id: string, data: { name?: string; slug?: string; plan?: string }) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.plan && { plan: data.plan }),
      }
    });
  }

  // --- USERS ---
  async getTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId },
      include: { role: true },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        role: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async updateUserGlobal(id: string, data: any) {
    const updateData: any = {};
    if (data.role_code !== undefined) updateData.role_code = data.role_code;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.granted_permissions !== undefined) updateData.granted_permissions = data.granted_permissions;
    if (data.revoked_permissions !== undefined) updateData.revoked_permissions = data.revoked_permissions;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        role: true
      }
    });
  }

  // --- ROLES ---
  async getRoles() {
    return this.prisma.role.findMany({
      orderBy: { code: 'asc' }
    });
  }

  async createRole(data: any) {
    return this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        permissions: data.permissions || [],
        is_system_role: false
      }
    });
  }

  async updateRole(id: string, data: any) {
    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        permissions: data.permissions
      }
    });
  }

  // --- PASSWORD MANAGEMENT ---
  async getUsersWithPassInfo() {
    // Returns all users with metadata — no plaintext hashes returned to client
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        role_code: true,
        status: true,
        created_at: true,
        last_login_at: true,
        tenant: { select: { id: true, name: true, slug: true } },
        role: { select: { name: true } }
      },
      orderBy: { created_at: 'asc' }
    });
  }

  async resetUserPassword(userId: string): Promise<{ newPassword: string }> {
    // Generate a new secure random password
    const newPassword = crypto.randomBytes(4).toString('hex').toUpperCase() + 'Rr1@';
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: hash }
    });
    return { newPassword };
  }

  private async sendWelcomeEmail(email: string, name: string, slug: string, tempPass: string) {
    console.log(`\n\n=== MOCK EMAIL A ${email} ===`);
    console.log(`Asunto: Bienvenido a Rusertech - Accesos`);
    console.log(`Hola ${name}, tu cuenta para la empresa ${slug} ha sido creada.`);
    console.log(`URL de acceso: https://app.rusertech.com/login`);
    console.log(`Tu contraseña temporal es: ${tempPass}`);
    console.log(`Por favor cámbiala al ingresar.`);
    console.log(`==================================\n\n`);
  }
}
