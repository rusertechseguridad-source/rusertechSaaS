import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendInvitation(params: {
    to: string;
    fullName: string;
    tempPassword: string;
    tenantName: string;
    loginUrl?: string;
  }) {
    const loginUrl = params.loginUrl || 'http://localhost:5173/login';

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

    try {
      const result = await this.resend.emails.send({
        from: 'Rusertech <onboarding@resend.dev>',
        to: [params.to],
        subject: `Invitación a Rusertech — ${params.tenantName}`,
        html,
      });
      console.log(`[MailService] Invitation sent to ${params.to}:`, result);
      return result;
    } catch (error) {
      console.error(`[MailService] Failed to send invitation to ${params.to}:`, error);
      throw error;
    }
  }
}
