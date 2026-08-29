import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { getRequiredSecret } from '../../common/config/secrets';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluarAcceso } from '../estado-cuenta';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Sin valor por defecto: antes había un secreto hardcodeado en el repo,
      // con el que cualquiera que leyera el código podía firmar tokens válidos.
      // Si falta la variable, la aplicación no arranca (ver common/config/secrets).
      secretOrKey: getRequiredSecret('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // El token dura 12 h. Sin esta consulta, suspender a un usuario o a un
    // cliente no surtía efecto hasta que su token venciera: seguía operando
    // media jornada después de la baja (verificación integral, §1.1).
    //
    // Es una consulta por request, por índice primario y con dos columnas.
    // A propósito NO se cachea: una caché de N minutos reintroduce exactamente
    // la ventana que este chequeo viene a cerrar, sólo que más corta.
    const cuenta = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, tenant: { select: { status: true } } },
    });

    const veredicto = evaluarAcceso({
      estadoUsuario: cuenta?.status,
      estadoTenant: cuenta?.tenant?.status,
    });
    if (!veredicto.permitido) {
      // Falla cerrado: un usuario borrado (`cuenta` nulo) también cae acá,
      // por el caso 'sin_datos' de evaluarAcceso.
      this.logger.warn(`Token rechazado para ${payload.sub}: ${veredicto.motivo}`);
      throw new UnauthorizedException();
    }

    // Este payload se inyecta en req.user
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  }
}
