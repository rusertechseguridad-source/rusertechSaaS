import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, plan: true, status: true }
    });
    return tenant;
  }

  async updateProfile(tenantId: string, data: { name?: string }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { name: data.name }
    });
  }

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, email: true, full_name: true, role_code: true, status: true }
    });
  }

  async inviteUser(tenantId: string, data: { email: string; full_name: string; role_code: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }
    
    // In a real scenario, this generates a token and sends an email.
    // For now, we set a default password for the invited user.
    const tempPassword = 'TempPassword123!';
    const hash = await bcrypt.hash(tempPassword, 10);
    
    const user = await this.prisma.user.create({
      data: {
        tenant_id: tenantId,
        email: data.email,
        full_name: data.full_name,
        role_code: data.role_code,
        password_hash: hash,
        status: 'active'
      }
    });
    
    // Return the user (excluding password)
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async updateUser(tenantId: string, userId: string, data: { role_code?: string, full_name?: string }) {
    return this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data,
      select: { id: true, email: true, full_name: true, role_code: true }
    });
  }

  async toggleUserStatus(tenantId: string, userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data: { status: isActive ? 'active' : 'suspended' },
      select: { id: true, email: true, status: true }
    });
  }

  // --- PARAMETERS ---
  async getParameters(tenantId: string) {
    // Get all tenant parameters
    const tenantParams = await this.prisma.parameterSetting.findMany({
      where: { tenant_id: tenantId }
    });
    
    // Get all global parameters (defaults)
    const globalParams = await this.prisma.parameterSetting.findMany({
      where: { tenant_id: null }
    });

    // Merge: Use tenant param if exists, else global
    const merged = globalParams.map(globalParam => {
      const tParam = tenantParams.find(p => p.parameter_key === globalParam.parameter_key);
      return tParam || globalParam;
    });

    return merged;
  }

  async updateParameter(tenantId: string, key: string, value: string, userId: string) {
    return this.prisma.parameterSetting.upsert({
      where: { tenant_id_parameter_key: { tenant_id: tenantId, parameter_key: key } },
      update: { parameter_value: value, updated_by: userId },
      create: {
        tenant_id: tenantId,
        parameter_key: key,
        parameter_value: value,
        updated_by: userId
      }
    });
  }

  async restoreParameterDefault(tenantId: string, key: string, userId: string) {
    // Just delete the tenant-specific parameter, so it falls back to the global one
    await this.prisma.parameterSetting.deleteMany({
      where: { tenant_id: tenantId, parameter_key: key }
    });
    return { success: true };
  }

  // --- SETTINGS JSON (Notifications & Carbon) ---
  async getNotificationsConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings_json: true }
    });
    const settings: any = tenant?.settings_json || {};
    return {
      smtp: settings.smtp || null,
      fcm: settings.fcm || null
    };
  }

  async updateNotificationsConfig(tenantId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings: any = tenant?.settings_json || {};
    settings.smtp = data.smtp;
    settings.fcm = data.fcm;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings_json: settings }
    });
  }

  async getCarbonConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings_json: true }
    });
    const settings: any = tenant?.settings_json || {};
    return {
      climatiq: settings.climatiq || null
    };
  }

  async updateCarbonConfig(tenantId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings: any = tenant?.settings_json || {};
    settings.climatiq = data.climatiq;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings_json: settings }
    });
  }

  // --- PARAMETERS ---
  async getTenantParameters(tenantId: string) {
    // 1. Obtener parámetros globales (tenant_id = null)
    const globals = await this.prisma.parameterSetting.findMany({
      where: { tenant_id: null },
      orderBy: { parameter_key: 'asc' }
    });

    // 2. Obtener overrides del tenant
    const overrides = await this.prisma.parameterSetting.findMany({
      where: { tenant_id: tenantId }
    });

    // 3. Merge
    const overrideMap = new Map(overrides.map(o => [o.parameter_key, o]));
    
    return globals.map(g => {
      const tenantOverride = overrideMap.get(g.parameter_key);
      return {
        ...g,
        // Si hay override, pisamos el valor
        parameter_value: tenantOverride ? tenantOverride.parameter_value : g.parameter_value,
        has_override: !!tenantOverride
      };
    });
  }

  async updateTenantParameter(tenantId: string, parameterKey: string, value: string, userId: string) {
    // Validar si el global existe y es editable
    const globalParam = await this.prisma.parameterSetting.findFirst({
      where: { tenant_id: null, parameter_key: parameterKey }
    });

    if (!globalParam) {
      throw new BadRequestException('Parameter does not exist');
    }

    if (!globalParam.is_editable_by_account_owner) {
      throw new BadRequestException('This parameter is locked by system administrator');
    }

    // Buscar si ya hay un override
    const existingOverride = await this.prisma.parameterSetting.findFirst({
      where: { tenant_id: tenantId, parameter_key: parameterKey }
    });

    if (existingOverride) {
      return this.prisma.parameterSetting.update({
        where: { id: existingOverride.id },
        data: {
          parameter_value: value,
          updated_by: userId
        }
      });
    } else {
      return this.prisma.parameterSetting.create({
        data: {
          tenant_id: tenantId,
          parameter_key: parameterKey,
          parameter_value: value,
          data_type: globalParam.data_type,
          description: globalParam.description,
          is_editable_by_account_owner: true, // Always true for overrides
          updated_by: userId
        }
      });
    }
  }

  async restoreTenantParameter(tenantId: string, parameterKey: string) {
    const existingOverride = await this.prisma.parameterSetting.findFirst({
      where: { tenant_id: tenantId, parameter_key: parameterKey }
    });

    if (existingOverride) {
      return this.prisma.parameterSetting.delete({
        where: { id: existingOverride.id }
      });
    }
    return { success: true };
  }
}
