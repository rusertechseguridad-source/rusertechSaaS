import { Injectable, Logger } from '@nestjs/common';
import { InformeDatosService } from './informe-datos.service';
import { renderInforme, type MarcadorMapa } from './informe-plantilla';
import { codificarPolyline, simplificarParaUrl } from './polyline';

/**
 * GENERACIÓN DEL INFORME.
 *
 * El HTML se arma siempre; el PDF lo imprime Chromium headless vía puppeteer.
 *
 * ── FOTOS DEL BUCKET PRIVADO ───────────────────────────────────────────────
 * Decisión tomada: EMBEBIDAS, no por URL firmada — un informe archivado no
 * puede depender de que un enlace siga vivo. Se descargan del bucket con la
 * service key (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) y se incrustan como
 * data URLs.
 *
 * Si las credenciales no están configuradas o una foto no se puede descargar,
 * el informe NO miente: el lugar de la foto muestra "no disponible al generar
 * el informe", con el tipo de evidencia. Un hueco explicado vale más que un
 * informe que falla entero por una foto.
 *
 * ── LOGO DEL TENANT ────────────────────────────────────────────────────────
 * Sale de `tenants.settings_json->report_logo` (data URL o ruta del bucket).
 * No se agregó columna: settings_json existe justamente para esto.
 */
@Injectable()
export class InformeService {
  private readonly logger = new Logger(InformeService.name);

  constructor(private readonly datos: InformeDatosService) {}

  async generarHtml(tripId: string, tenantId: string): Promise<string> {
    const d = await this.datos.obtener(tripId, tenantId);

    const fotosEmbebidas = await this.descargarFotos(d.fotos);
    const logoDataUrl = await this.resolverLogo(d.viaje.tenant_settings);
    const mapaEstatico = await this.mapaEstatico(
      d.resumen?.recorrido_geojson ?? null,
      (d.excursiones ?? [])
        .filter((e: any) => e.latitude != null)
        .map((e: any) => ({
          lat: Number(e.latitude),
          lng: Number(e.longitude),
          etiqueta: `${Number(e.valor_extremo).toFixed(0)}°`,
        })),
    );

    return renderInforme({ ...d, fotosEmbebidas, logoDataUrl, mapaEstatico });
  }

  // ── Cartografía real (MapTiler) ───────────────────────────────────────────

  /**
   * Fondo cartográfico del recorrido, embebido como data URL.
   *
   * Proveedor elegido por Gustavo: MapTiler (mapa estático). Requiere
   * MAPTILER_API_KEY en el entorno; su cuota gratuita sobra para el volumen
   * actual de informes.
   *
   * DEGRADACIÓN, siempre: sin key, sin respuesta o con error, devuelve null y
   * la plantilla cae al trazado esquemático con su nota al pie. El informe
   * nunca falla por el mapa.
   *
   * La ruta viaja como polilínea codificada (enc:) y muestreada a 300 vértices
   * como máximo: es el fondo visual, no la geometría de archivo — esa vive en
   * trip_summary.recorrido.
   */
  private async mapaEstatico(
    recorridoGeojson: string | null,
    marcadores: MarcadorMapa[],
  ): Promise<string | null> {
    const key = process.env.MAPTILER_API_KEY;
    if (!key || !recorridoGeojson) return null;

    let coords: [number, number][];
    try {
      const g = JSON.parse(recorridoGeojson);
      // GeoJSON es [lng, lat]; el codificador espera [lat, lng].
      coords = (g?.coordinates ?? []).map((c: number[]) => [c[1], c[0]] as [number, number]);
    } catch {
      return null;
    }
    if (coords.length < 2) return null;

    const enc = codificarPolyline(simplificarParaUrl(coords));
    const origen = coords[0];
    const destino = coords[coords.length - 1];

    const partes = [
      `path=stroke:%231D4ED8|width:3|enc:${encodeURIComponent(enc)}`,
      `markers=${origen[1]},${origen[0]},%23059669|${destino[1]},${destino[0]},%23B91C1C`,
    ];
    // Las excursiones, marcadas en rojo sobre la cartografía (máx. 10: más que
    // eso satura el mapa y la tabla ya las lista todas).
    for (const m of marcadores.slice(0, 10)) {
      partes.push(`markers=${m.lng},${m.lat},%23B91C1C`);
    }

    const url =
      `https://api.maptiler.com/maps/streets-v2/static/auto/700x300.png` +
      `?${partes.join('&')}&attribution=bottomright&key=${key}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        this.logger.warn(`MapTiler respondió ${res.status}: el informe usa el trazado esquemático.`);
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error) {
      this.logger.warn(
        `MapTiler no disponible (${(error as Error).message}): el informe usa el trazado esquemático.`,
      );
      return null;
    }
  }

  /**
   * HTML → PDF con Chromium headless.
   *
   * puppeteer se carga con require dinámico: es una dependencia opcional.
   * Si no está instalada o Chromium no arranca, el llamador recibe null y el
   * endpoint devuelve el HTML imprimible con una nota — el informe existe
   * igual, sólo que el PDF lo hace el navegador del usuario con Ctrl+P.
   */
  async generarPdf(tripId: string, tenantId: string): Promise<Buffer | null> {
    const html = await this.generarHtml(tripId, tenantId);

    let puppeteer: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      puppeteer = require('puppeteer');
    } catch {
      this.logger.warn(
        'puppeteer no está instalado: el informe se sirve como HTML imprimible. `npm i puppeteer` en apps/api lo habilita.',
      );
      return null;
    }

    let browser: any = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        // Estos flags son necesarios en contenedores; inofensivos fuera.
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(process.env.PUPPETEER_EXECUTABLE_PATH
          ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
          : {}),
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
      });
      return pdf;
    } catch (error) {
      this.logger.error(`No se pudo imprimir el PDF: ${(error as Error).message}`);
      return null;
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }

  // ── Bucket privado ────────────────────────────────────────────────────────

  private bucketConfigurado(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  private async descargarFotos(fotos: { id: string; storage_path: string }[]): Promise<Map<string, string>> {
    const resultado = new Map<string, string>();
    if (fotos.length === 0) return resultado;

    if (!this.bucketConfigurado()) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados: las fotos del informe salen como "no disponible".',
      );
      return resultado;
    }

    for (const foto of fotos) {
      try {
        const dataUrl = await this.descargarDelBucket(foto.storage_path);
        if (dataUrl) resultado.set(foto.id, dataUrl);
      } catch (error) {
        // Una foto que falla no tumba el informe: su lugar queda explicado.
        this.logger.warn(`Foto ${foto.storage_path}: ${(error as Error).message}`);
      }
    }
    return resultado;
  }

  /**
   * Descarga por la API REST de Supabase Storage. `storage_path` viene como
   * `bucket/ruta/interna.jpg` (lo escribe la Mobile API).
   *
   * Reescalado: no se hace acá — las fotos de la app ya vienen comprimidas
   * para 4G. Si el peso del PDF se vuelve un problema con fotos reales, el
   * reescalado se agrega en este punto único.
   */
  private async descargarDelBucket(storagePath: string): Promise<string | null> {
    const barra = storagePath.indexOf('/');
    if (barra <= 0) return null;
    const bucket = storagePath.slice(0, barra);
    const ruta = storagePath.slice(barra + 1);

    const url = `${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${ruta}`;
    const respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!respuesta.ok) {
      this.logger.warn(`Bucket respondió ${respuesta.status} para ${storagePath}`);
      return null;
    }
    const tipo = respuesta.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    return `data:${tipo};base64,${buffer.toString('base64')}`;
  }

  private async resolverLogo(settings: any): Promise<string | null> {
    const logo = settings?.report_logo;
    if (!logo || typeof logo !== 'string') return null;
    if (logo.startsWith('data:')) return logo;
    if (this.bucketConfigurado()) {
      try {
        return await this.descargarDelBucket(logo);
      } catch {
        return null;
      }
    }
    return null;
  }
}
