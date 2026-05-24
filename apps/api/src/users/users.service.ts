import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Buscar un usuario por email (usado para login).
  // Se usa el prisma normal sin extensión RLS porque en el login
  // aún no tenemos un tenant_id en el contexto.
  async findByEmail(email: string): Promise<User & { role?: any } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });
  }

  // Ejemplo de búsqueda con RLS activado (para CRUD regular)
  async findById(id: string): Promise<User | null> {
    return this.prisma.extended.user.findUnique({
      where: { id },
    });
  }
}
