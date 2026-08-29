import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * PATCH /api/v1/operational-protocols/:id
 *
 * Campos copiados de `model OperationalProtocol` en schema.prisma.
 * NO están: `id`, `tenant_id`, `created_at`.
 *
 * ⚠️ `tenant_id` es el punto entero de este DTO. `assertProtocoloEditable` ya
 * comprobaba de quién ERA el protocolo, pero el `update` recibía el cuerpo
 * crudo: mandando `{"tenant_id": null}` un cliente convertía **su** protocolo
 * en GLOBAL, y a partir de ahí se lo aplicaba a todos los tenants. La reja
 * miraba la fila vieja y no lo que se estaba escribiendo.
 *
 * Es el mismo mecanismo que la Fase C cerró en la base con `ON DELETE RESTRICT`,
 * entrando por otra puerta — y la misma asignación masiva de la Tanda 3, en un
 * controller que no estaba en aquella lista de seis.
 */
export class ActualizarProtocoloDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString()
  description?: string | null;

  @IsOptional() @IsString() @MaxLength(30)
  trip_status?: string;

  @IsOptional() @IsString() @MaxLength(100)
  sub_status?: string;

  @IsOptional() @IsString() @MaxLength(20)
  gps_reporting?: string;

  @IsOptional() @IsString() @MaxLength(20)
  driver_communication?: string;

  @IsOptional() @IsString() @MaxLength(20)
  risk_level?: string;

  // `Json @default("[]")`: la lista de pasos del protocolo.
  @IsOptional() @IsArray()
  protocol_steps?: unknown[];

  // Un mes en minutos como techo: un SLA mayor es un error de tipeo, no un dato.
  @IsOptional() @IsInt() @Min(0) @Max(43200)
  sla_minutes?: number | null;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
