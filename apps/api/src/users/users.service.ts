import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Buscar un usuario por email (usado para login).
  // Se usa el prisma normal sin extensión RLS porque en el login
  // aún no tenemos un tenant_id en el contexto.
  async findByEmail(
    email: string,
  ): Promise<(User & { role?: any; tenant?: { status: string } }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
      // `tenant.status` se suma para que el login pueda negar el acceso a un
      // cliente suspendido. Se proyecta sólo `status`: el resto de la fila del
      // tenant incluye `settings_json`, que trae credenciales SMTP.
      include: { role: true, tenant: { select: { status: true } } }
    });
  }

  // Ejemplo de búsqueda con RLS activado (para CRUD regular)
  async findById(id: string): Promise<User & { role?: any } | null> {
    return this.prisma.extended.user.findUnique({
      where: { id },
      include: { role: true }
    });
  }

  async getUserWithPermissions(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });
    
    if (!user) return null;

    let perms = new Set<string>();
    if (user.role?.permissions) {
      user.role.permissions.forEach((p: string) => perms.add(p));
    }
    if (user.granted_permissions) {
      user.granted_permissions.forEach(p => perms.add(p));
    }
    if (user.revoked_permissions) {
      user.revoked_permissions.forEach(p => perms.delete(p));
    }

    return {
      ...user,
      permissions: Array.from(perms)
    };
  }
}
