import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
// `crypto` y `nodemailer` estaban importados y NO se usaban: `crypto` quedó
// libre al mover la generación de claves a `generarClaveTemporal`, y
// `nodemailer` nunca se usó (el correo va por Resend). Un import muerto de una
// librería de correo confunde a quien busca por dónde sale el correo.
import { generarClaveTemporal } from '../common/crypto/clave-temporal';
import { exigirRolAsignable } from '../settings/roles-asignables';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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
    // Viajes activos = los que NO están en un estado terminal, según el catálogo
    // `motor_estados_viaje`. Antes contaba `['planned','in_progress']`, dos valores
    // que ningún escritor del sistema produce: el panel mostraba 0 siempre.
    //
    // Se cuenta por NEGACIÓN a propósito. `trips.status` no tiene FK al catálogo
    // (la Mobile API escribe esa columna y una FK rechazaría su INSERT), así que
    // puede aparecer un código desconocido. Con un INNER JOIN ese viaje
    // desaparecería del conteo sin avisar — el mismo fallo silencioso que el
    // motor. Contando "todo lo que no es terminal", un estado que nadie previó
    // se ve en el número en lugar de esconderse.
    const [{ activos }] = await this.prisma.$queryRaw<Array<{ activos: bigint }>>`
      SELECT count(*) AS activos
      FROM trips t
      WHERE t.tenant_id = ${id}::uuid
        AND t.status NOT IN (
          SELECT codigo FROM motor_estados_viaje WHERE es_terminal
        )
    `;
    const activeTrips = Number(activos);
    const openAlerts = await this.prisma.eventLog.count({ where: { tenant_id: id, status: 'active' } });
    
    return { vehicles, activeTrips, openAlerts };
  }

  async createTenant(data: { name: string; slug: string; plan: string; adminEmail: string; adminFullName: string }) {
    // Validar slug
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('El slug del tenant ya existe.');
    
    // Generar password temporal
    // 4 bytes = 32 bits. Ver common/crypto/clave-temporal.ts.
    const tempPassword = generarClaveTemporal();
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

    // 5. Enviar email de bienvenida.
    // El envío va FUERA de la transacción y no la revierte: el tenant ya existe
    // y borrarlo por un fallo de correo sería peor. Pero el resultado se informa
    // (`emailSent`), porque la contraseña temporal ya no queda en ningún otro
    // lado — si el correo no salió, el tenant nace inaccesible y hay que
    // regenerar la clave con `POST /admin/users/:id/reset-password`.
    const emailSent = await this.sendWelcomeEmail(
      result.user.email,
      result.user.full_name || '',
      result.tenant.name,
      result.tempPassword,
    );

    return {
      message: 'Tenant creado exitosamente',
      tenantId: result.tenant.id,
      adminEmail: result.user.email,
      emailSent
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

  async updateUserGlobal(id: string, data: any, editorId?: string) {
    // Ésta es la ruta por la que la escalada seguía pasando: `checkSuperAdmin`
    // controla QUIÉN entra, y nadie controlaba QUÉ rol se asigna. Un
    // administrador de plataforma podía otorgar `rusertech_admin` desde una
    // pantalla, sin rastro y sin segundo factor.
    exigirRolAsignable(
      { rolSolicitado: data.role_code, editorId, objetivoId: id },
      'AdminService.updateUserGlobal',
    );

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
    // El encargo nombraba sólo `createTenant`, pero es LA MISMA línea con
    // otro sufijo, en el mismo archivo, generando la misma clase de secreto.
    // Dejar una en 4 bytes mientras se sube la otra a 16 no sería defendible.
    const newPassword = generarClaveTemporal();
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: hash }
    });
    return { newPassword };
  }

  /**
   * Envía las credenciales del `account_owner` del tenant recién creado.
   *
   * Antes esto era un mock de seis `console.log` que no mandaba nada, y uno de
   * ellos imprimía la contraseña temporal en texto plano. Las dos ramas eran
   * malas: o alguien leía el log del servidor y se quedaba con la credencial
   * del administrador de ese cliente, o nadie lo leía y el tenant nacía
   * inaccesible (verificación integral, §2.6).
   *
   * Devuelve si el correo salió. NO relanza: el tenant ya está creado y el
   * llamador necesita poder informarlo, no perder la operación entera.
   */
  private async sendWelcomeEmail(
    email: string,
    name: string,
    tenantName: string,
    tempPass: string,
  ): Promise<boolean> {
    // ⚠️ El `try/catch` que había acá NO cubría el caso real. El SDK de Resend
    // resuelve con `{ data: null, error }` cuando la API rechaza el envío (por
    // ejemplo, la cuenta en modo de prueba), así que no había excepción que
    // capturar y esto devolvía `true` con el correo sin salir. Ahora
    // `sendInvitation` devuelve el resultado y se lo mira.
    // El `try/catch` se conserva, pero ya NO es el mecanismo: `sendInvitation`
    // se comprometió a no lanzar y a devolver el resultado. Queda como red de
    // seguridad porque esto corre DESPUÉS de que la transacción confirmó, y un
    // error inesperado del cliente de correo no puede tirar abajo la respuesta
    // de un tenant que ya existe.
    let envio: { enviado: boolean; motivo?: string };
    try {
      envio = await this.mailService.sendInvitation({
        to: email,
        fullName: name,
        tempPassword: tempPass,
        tenantName,
      });
    } catch (error) {
      envio = { enviado: false, motivo: (error as Error).message };
    }

    if (envio.enviado) return true;

    // El motivo se registra SIN la contraseña: ese era justamente el problema.
    this.logger.error(
      `No se pudo enviar el correo de alta a ${email}: ${envio.motivo ?? 'sin motivo'} ` +
        'El tenant quedó creado pero su administrador no recibió la clave: ' +
        'regenerarla con POST /admin/users/:id/reset-password.',
    );
    return false;
  }

  // --- GLOBAL PARAMETERS ---
  async getGlobalParameters() {
    return this.prisma.parameterSetting.findMany({
      where: { tenant_id: null },
      orderBy: { parameter_key: 'asc' }
    });
  }

  async createGlobalParameter(data: any, userId: string) {
    // Verificamos si existe
    const exists = await this.prisma.parameterSetting.findFirst({
      where: { tenant_id: null, parameter_key: data.parameter_key }
    });
    if (exists) throw new ConflictException('Global parameter already exists');

    return this.prisma.parameterSetting.create({
      data: {
        parameter_key: data.parameter_key,
        parameter_value: data.parameter_value,
        data_type: data.data_type,
        description: data.description,
        is_editable_by_account_owner: data.is_editable_by_account_owner,
        updated_by: userId
      }
    });
  }

  async updateGlobalParameter(id: string, data: any, userId: string) {
    return this.prisma.parameterSetting.update({
      where: { id },
      data: {
        parameter_value: data.parameter_value,
        data_type: data.data_type,
        description: data.description,
        is_editable_by_account_owner: data.is_editable_by_account_owner,
        updated_by: userId
      }
    });
  }

  async deleteGlobalParameter(id: string) {
    return this.prisma.parameterSetting.delete({
      where: { id }
    });
  }
}
