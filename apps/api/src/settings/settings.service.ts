import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { generarClaveTemporal } from '../common/crypto/clave-temporal';
import {
  enmascararSettingsJson,
  cifrarCredencialesNotificaciones,
} from '../common/crypto/credenciales-notificaciones';
import * as bcrypt from 'bcrypt';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { exigirRolAsignable } from './roles-asignables';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

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
      select: { id: true, email: true, full_name: true, role_code: true, status: true, entity_restrictions: true }
    });
  }

  async inviteUser(tenantId: string, data: { email: string; full_name: string; role_code: string }) {
    // ⚠️ La escalada NO necesitaba editar a nadie: un `account_owner` invitaba
    // un usuario NUEVO con `rusertech_admin` y entraba con esa cuenta. La
    // Tanda 3 protegió el `update` y dejó esta puerta abierta.
    // `objetivoId` no aplica: el usuario todavía no existe, así que sólo puede
    // dispararse la regla del rol de plataforma, que es la que importa acá.
    exigirRolAsignable({ rolSolicitado: data.role_code }, 'SettingsService.inviteUser');

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    // ⚠️ Era `Math.random()`, que no es aleatorio: de unas pocas salidas se
    // reconstruye el estado del generador y se predicen las siguientes. Quien
    // pidiera un par de invitaciones a direcciones propias podía predecir la
    // contraseña de la siguiente invitación, fuera de quien fuera.
    const tempPassword = generarClaveTemporal();
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

    // Fetch tenant name for the email
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });

    // ⚠️ ACÁ ESTABA EL AGUJERO, y no en la ausencia de `emailSent`.
    //
    // El `emailSent` ya existía, pero se decidía con un `try/catch` alrededor
    // de `sendInvitation`, y el SDK de Resend NO LANZA cuando la API rechaza
    // el envío: resuelve con `{ data: null, error }`. El rechazo por modo de
    // prueba —"You can only send testing emails to your own email address"—
    // llega por ese camino. Así que el catch nunca corría, `emailSent` valía
    // `true`, y la pantalla decía que el usuario había sido invitado mientras
    // su contraseña temporal no llegaba a ninguna parte.
    //
    // Ahora `sendInvitation` devuelve el resultado y hay que mirarlo. El
    // usuario se crea igual (borrarlo por un fallo de correo sería peor), pero
    // se informa el motivo para que quien invita pueda accionarlo: la clave se
    // regenera con POST /admin/users/:id/reset-password.
    // El `try/catch` queda como red de seguridad, no como mecanismo: el
    // usuario YA está creado en la base y un error inesperado del cliente de
    // correo no puede convertir un alta exitosa en un 500.
    let envio: { enviado: boolean; motivo?: string };
    try {
      envio = await this.mailService.sendInvitation({
        to: data.email,
        fullName: data.full_name,
        tempPassword,
        tenantName: tenant?.name || 'Rusertech',
      });
    } catch (error) {
      envio = { enviado: false, motivo: (error as Error).message };
    }

    const { password_hash, ...safeUser } = user;

    if (!envio.enviado) {
      // El motivo se registra SIN la contraseña temporal: que quedara en el
      // log es lo que corrigió la Tanda 1 en el camino hermano.
      this.logger.error(
        `Usuario ${data.email} creado pero el correo de invitación no salió: ${envio.motivo ?? 'sin motivo'}`,
      );
      return { ...safeUser, emailSent: false, emailError: envio.motivo ?? 'sin motivo' };
    }

    return { ...safeUser, emailSent: true };
  }

  // El tipo del parámetro es el DTO, no una lista repetida acá: si mañana se
  // agrega un campo editable, se agrega en un solo lugar. La lista suelta que
  // había antes ya se había desincronizado (no incluía `status`).
  async updateUser(tenantId: string, userId: string, data: ActualizarUsuarioDto, editorId?: string) {
    // La comprobación vive acá y no sólo en el controller: así cualquier ruta
    // futura que llame a este método queda cubierta sin acordarse de nada.
    exigirRolAsignable(
      { rolSolicitado: data.role_code, editorId, objetivoId: userId },
      'SettingsService.updateUser',
    );

    return this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data,
      select: { id: true, email: true, full_name: true, role_code: true, entity_restrictions: true }
    });
  }

  async toggleUserStatus(tenantId: string, userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data: { status: isActive ? 'active' : 'suspended' },
      select: { id: true, email: true, status: true }
    });
  }

  async deleteUser(tenantId: string, userId: string) {
    return this.prisma.user.delete({
      where: { id: userId, tenant_id: tenantId }
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
    // La contraseña SMTP no sale de acá. La pantalla recibe el marcador
    // `__guardado__` para poder distinguir "hay una configurada" de "no hay
    // ninguna" sin llevarse el valor.
    const enmascarado: any = enmascararSettingsJson(settings);
    return {
      smtp: enmascarado.smtp || null,
      fcm: enmascarado.fcm || null
    };
  }

  async updateNotificationsConfig(tenantId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings: any = tenant?.settings_json || {};
    // Los secretos se cifran al entrar. Si el formulario reenvía el marcador
    // —porque el operador cambió el host y no tocó la contraseña— se conserva
    // la que ya estaba en vez de pisarla con la cadena del marcador.
    settings.smtp = cifrarCredencialesNotificaciones(data.smtp, settings.smtp);
    settings.fcm = data.fcm;
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings_json: settings }
    });
    // La respuesta del guardado va enmascarada por lo mismo que la lectura: si
    // no, filtraría justo lo que la lectura protege.
    return enmascararSettingsJson(settings);
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
