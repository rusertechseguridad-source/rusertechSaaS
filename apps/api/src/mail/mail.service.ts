import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { ResultadoEnvio, motivoLegible } from './resultado-envio';

/** Remitente de prueba de Resend: sólo entrega al dueño de la cuenta. */
const REMITENTE_POR_DEFECTO = 'Rusertech <onboarding@resend.dev>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;

  /**
   * ⚠️ EL CLIENTE SE CONSTRUYE TARDE, Y NO ES UN DETALLE.
   *
   * Antes el constructor hacía `new Resend(process.env.RESEND_API_KEY)`. El SDK
   * LANZA si la clave es `undefined` ("Missing API key. Pass it to the
   * constructor"), y este servicio lo instancia Nest al levantar el módulo: sin
   * `RESEND_API_KEY`, **la API entera no arrancaba**, con un mensaje que no
   * menciona ninguna variable de entorno ni el correo.
   *
   * Lo encontró la prueba de esta tanda al borrar la variable, no una lectura
   * del código: el `.env` de desarrollo siempre la tenía.
   *
   * Que falte la clave tiene que dejar la aplicación SIN CORREO, no sin
   * aplicación — el correo es opcional y el chequeo de arranque ya lo avisa
   * con todas las letras. Por eso el cliente se crea en el primer envío.
   */
  private cliente(): Resend | null {
    const clave = process.env.RESEND_API_KEY?.trim();
    if (!clave) return null;
    if (!this.resend) this.resend = new Resend(clave);
    return this.resend;
  }

  /**
   * De dónde sale el remitente.
   *
   * Estaba escrito en dos constantes distintas dentro de este archivo
   * (`onboarding@resend.dev` y `alertas@resend.dev`), así que verificar un
   * dominio propio obligaba a tocar el código y volver a desplegar. Ahora sale
   * de `MAIL_FROM` y el valor por defecto es el de prueba, que es lo que
   * corresponde en desarrollo.
   *
   * Se lee en cada envío, no en el constructor, para que una prueba pueda
   * cambiar la variable sin reconstruir el servicio.
   */
  private remitente(): string {
    return process.env.MAIL_FROM?.trim() || REMITENTE_POR_DEFECTO;
  }

  /**
   * Envía y devuelve QUÉ PASÓ. Nunca lanza.
   *
   * ⚠️ Los dos caminos de fallo son distintos y hay que cubrir los dos:
   *   · la promesa se rechaza  → problema de red, o el SDK no pudo ni hablar;
   *   · la promesa RESUELVE con `{ data: null, error }` → la API rechazó el
   *     envío. Éste es el que se estaba perdiendo: no hay excepción, así que
   *     un `try/catch` alrededor no ve nada y el llamador concluye que salió.
   */
  private async enviar(params: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<ResultadoEnvio> {
    const resend = this.cliente();
    if (!resend) {
      return {
        enviado: false,
        motivo:
          'No hay RESEND_API_KEY configurada: no se intentó enviar el correo. ' +
          'Ver README_DESPLIEGUE.md § Correo.',
      };
    }

    try {
      const respuesta = await resend.emails.send({
        from: this.remitente(),
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      if (respuesta.error) {
        const motivo = motivoLegible(respuesta.error);
        this.logger.error(`Envío rechazado para ${params.to.join(', ')}: ${motivo}`);
        return { enviado: false, motivo };
      }

      this.logger.log(`Correo enviado a ${params.to.join(', ')} (id ${respuesta.data?.id ?? '—'})`);
      return { enviado: true, id: respuesta.data?.id ?? null };
    } catch (error) {
      const motivo = `No se pudo contactar al proveedor de correo: ${(error as Error).message}`;
      this.logger.error(motivo);
      return { enviado: false, motivo };
    }
  }

  async sendInvitation(params: {
    to: string;
    fullName: string;
    tempPassword: string;
    tenantName: string;
    loginUrl?: string;
  }): Promise<ResultadoEnvio> {
    // El enlace del botón del correo. `APP_URL` porque apunta al FRONTEND, que
    // puede vivir en otro dominio que la API.
    const loginUrl =
      params.loginUrl || `${process.env.APP_URL?.trim() || 'http://localhost:5173'}/login`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a Rusertech</title>
</head>
<body style="margin:0;padding:0;background:#0a121e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a121e;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1e3a5f;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f2944,#0d1f35);padding:32px 40px;text-align:center;border-bottom:1px solid #1e3a5f;">
              <h1 style="margin:0;font-size:28px;font-weight:900;background:linear-gradient(90deg,#34eba0,#2ab3ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;">
                Rusertech
              </h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
                Seguridad &amp; Logística
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#ffffff;font-size:20px;margin:0 0 12px;">¡Hola, ${params.fullName}!</h2>
              <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Fuiste invitado/a a unirte a la plataforma <strong style="color:#2ab3ff;">Rusertech</strong> 
                como parte del equipo de <strong style="color:#ffffff;">${params.tenantName}</strong>.
              </p>

              <!-- Credentials Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a121e;border:1px solid #1e3a5f;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">Tus credenciales de acceso</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;">
                          <span style="color:#94a3b8;font-size:13px;">Email</span>
                        </td>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;text-align:right;">
                          <span style="color:#2ab3ff;font-size:13px;font-weight:700;">${params.to}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#94a3b8;font-size:13px;">Contraseña temporal</span>
                        </td>
                        <td style="padding:8px 0;text-align:right;">
                          <span style="color:#34eba0;font-size:14px;font-weight:900;font-family:monospace;letter-spacing:2px;">${params.tempPassword}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f0a;border:1px solid #92400e;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="color:#fbbf24;font-size:13px;margin:0;">
                      ⚠️ <strong>Importante:</strong> Por tu seguridad, cambiá tu contraseña inmediatamente después de tu primer ingreso.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" 
                       style="display:inline-block;background:linear-gradient(135deg,#2ab3ff,#34eba0);color:#000000;font-weight:900;font-size:15px;padding:14px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                      Ingresar a Rusertech →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e3a5f;text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                Si no esperabas este email, podés ignorarlo con seguridad.<br/>
                &copy; ${new Date().getFullYear()} Rusertech — Seguridad &amp; Logística
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // ⚠️ Sin `try/catch` acá y sin `throw`: `enviar()` no lanza nunca y
    // devuelve el resultado. Quien invita TIENE que mirarlo — que era
    // justamente lo que no pasaba.
    return this.enviar({
      to: [params.to],
      subject: `Invitación a Rusertech — ${params.tenantName}`,
      html,
    });
  }

  async sendVehicleBlockedAlert(params: {
    plate: string;
    reason: string;
    toEmails: string[];
    tenantName?: string;
  }): Promise<ResultadoEnvio> {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ALERTA CRÍTICA: Vehículo Bloqueado</title>
</head>
<body style="margin:0;padding:0;background:#0a121e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a121e;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #7f1d1d;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7f1d1d,#450a0a);padding:32px 40px;text-align:center;border-bottom:1px solid #ef4444;">
              <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:1px;">
                ⚠️ ALERTA DE BLOQUEO
              </h1>
              <p style="margin:6px 0 0;color:#fca5a5;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
                Rusertech Seguridad
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#ffffff;font-size:20px;margin:0 0 12px;">Se ha bloqueado un vehículo</h2>
              <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
                El vehículo con patente <strong style="color:#ef4444;font-size:18px;">${params.plate}</strong> 
                ha sido bloqueado operativamente. Se ha detenido la ingesta de telemetría de este activo de forma inmediata.
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a121e;border:1px solid #1e3a5f;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">Detalles del Bloqueo</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;">
                          <span style="color:#94a3b8;font-size:13px;">Patente</span>
                        </td>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;text-align:right;">
                          <span style="color:#ffffff;font-size:14px;font-weight:700;">${params.plate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;">
                          <span style="color:#94a3b8;font-size:13px;">Empresa / Tenant</span>
                        </td>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;text-align:right;">
                          <span style="color:#ffffff;font-size:13px;font-weight:700;">${params.tenantName || 'No especificada'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;">
                          <span style="color:#94a3b8;font-size:13px;">Fecha y Hora</span>
                        </td>
                        <td style="padding:8px 0;border-bottom:1px solid #1e3a5f;text-align:right;">
                          <span style="color:#ffffff;font-size:13px;font-weight:700;">${new Date().toLocaleString('es-AR')}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#94a3b8;font-size:13px;">Motivo</span>
                        </td>
                        <td style="padding:8px 0;text-align:right;">
                          <span style="color:#fca5a5;font-size:13px;font-weight:700;">${params.reason}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f0a;border:1px solid #92400e;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="color:#fbbf24;font-size:13px;margin:0;">
                      ⚠️ <strong>Aviso al Operador AVL:</strong> Para reanudar el seguimiento, contacte con el responsable de cuenta o libere el vehículo desde el panel de control.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e3a5f;text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                Este es un mensaje automático de Rusertech.<br/>
                &copy; ${new Date().getFullYear()} Rusertech — Seguridad &amp; Logística
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // El bloqueo del vehículo NO se revierte si el correo falla: el vehículo
    // ya está bloqueado y eso es lo importante. Pero el fallo queda en el log
    // con su motivo (lo hace `enviar`) en vez de perderse.
    return this.enviar({
      to: params.toEmails,
      subject: `⚠️ ALERTA: Vehículo ${params.plate} Bloqueado`,
      html,
    });
  }
}
