/**
 * PLANTILLA HTML DEL INFORME DE VIAJE.
 *
 * Se renderiza en el backend y se imprime a PDF con Chromium: el documento es
 * idéntico siempre, sin depender del navegador de quien lo abra.
 *
 * Sin dependencias: el gráfico de temperatura y el mapa del recorrido son SVG
 * generados acá. Un informe probatorio no puede depender de un CDN vivo.
 *
 * Decisiones visuales del gráfico (guía de visualización de datos):
 *  · una sola serie → sin leyenda; el título la nombra
 *  · la banda del rango objetivo en gris neutro, no en color de dato
 *  · las excursiones en rojo de ESTADO (#B91C1C) con etiqueta, nunca solo color
 *  · texto siempre en tinta, nunca en el color de la serie
 *  · paleta validada contra superficie blanca (contraste y visión de color)
 */

const AZUL_SERIE = '#1D4ED8';
const ROJO_ESTADO = '#B91C1C';
const GRIS_BANDA = '#E5E7EB';
const TINTA = '#111827';
const TINTA_SUAVE = '#6B7280';

export interface DatosInforme {
  viaje: any;
  resumen: any;
  historial: any[];
  series: any[];
  excursiones: any[];
  condiciones: any[];
  fotos: any[];
  alertas: any[];
  /** data URLs de las fotos ya descargadas del bucket; clave = attachment id. */
  fotosEmbebidas: Map<string, string>;
  logoDataUrl: string | null;
  /** PNG de MapTiler como data URL, o null → se dibuja el trazado esquemático. */
  mapaEstatico?: string | null;
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fecha = (v: unknown): string => (v ? new Date(v as string).toLocaleString('es-AR') : '—');

const duracion = (segundos: number): string => {
  if (segundos < 60) return `${segundos} s`;
  if (segundos < 3600) return `${Math.floor(segundos / 60)} min`;
  return `${Math.floor(segundos / 3600)} h ${Math.floor((segundos % 3600) / 60)} min`;
};

/**
 * Gráfico de temperatura: línea de la serie, banda del rango objetivo y
 * excursiones resaltadas. SVG puro, 700×220.
 */
export function graficoSensor(serie: any, excursiones: any[]): string {
  const puntos: [number, number][] = Array.isArray(serie.serie) ? serie.serie : [];
  if (puntos.length < 2) return '';

  const W = 700, H = 220, mL = 46, mR = 12, mT = 12, mB = 26;
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => Number(p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  // La escala Y incluye el rango objetivo aunque la serie no lo toque: sin la
  // banda a la vista, el dato no significa nada.
  const y0 = Math.min(...ys, Number(serie.rango_min)) - 1;
  const y1 = Math.max(...ys, Number(serie.rango_max)) + 1;

  const X = (t: number) => mL + ((t - x0) / Math.max(1, x1 - x0)) * (W - mL - mR);
  const Y = (v: number) => mT + (1 - (v - y0) / Math.max(0.001, y1 - y0)) * (H - mT - mB);

  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(Number(p[1])).toFixed(1)}`).join(' ');

  // Banda del rango objetivo
  const banda = `<rect x="${mL}" y="${Y(Number(serie.rango_max)).toFixed(1)}" width="${W - mL - mR}"
    height="${(Y(Number(serie.rango_min)) - Y(Number(serie.rango_max))).toFixed(1)}"
    fill="${GRIS_BANDA}" opacity="0.55"/>`;

  // Excursiones: franja vertical roja tenue + etiqueta con el extremo
  const zonas = excursiones
    .filter((e) => e.sensor_type === serie.sensor_type)
    .map((e) => {
      const ex0 = X(new Date(e.inicio).getTime() / 1000);
      const ex1 = X(new Date(e.fin ?? e.inicio).getTime() / 1000);
      return `<rect x="${ex0.toFixed(1)}" y="${mT}" width="${Math.max(2, ex1 - ex0).toFixed(1)}"
        height="${H - mT - mB}" fill="${ROJO_ESTADO}" opacity="0.12"/>
        <text x="${((ex0 + ex1) / 2).toFixed(1)}" y="${mT + 12}" font-size="9" fill="${ROJO_ESTADO}"
          text-anchor="middle">${esc(Number(e.valor_extremo).toFixed(1))}°</text>`;
    })
    .join('');

  // Eje Y: 4 marcas, con los límites del rango siempre presentes
  const marcasY = [...new Set([y0 + 1, Number(serie.rango_min), Number(serie.rango_max), y1 - 1])]
    .map((v) => `<line x1="${mL - 4}" y1="${Y(v).toFixed(1)}" x2="${W - mR}" y2="${Y(v).toFixed(1)}"
        stroke="#F3F4F6" stroke-width="1"/>
      <text x="${mL - 8}" y="${(Y(v) + 3).toFixed(1)}" font-size="9" fill="${TINTA_SUAVE}"
        text-anchor="end">${v.toFixed(0)}°</text>`)
    .join('');

  // Eje X: inicio, medio y fin
  const marcasX = [x0, (x0 + x1) / 2, x1]
    .map((t) => `<text x="${X(t).toFixed(1)}" y="${H - 8}" font-size="9" fill="${TINTA_SUAVE}"
        text-anchor="middle">${new Date(t * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</text>`)
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Serie de ${esc(serie.sensor_type)}">
    ${marcasY}${banda}${zonas}
    <path d="${linea}" fill="none" stroke="${AZUL_SERIE}" stroke-width="2" stroke-linejoin="round"/>
    ${marcasX}
  </svg>`;
}

/** Mapa del recorrido: polilínea del LineString sobre un lienzo con escala. */
export interface MarcadorMapa {
  lat: number;
  lng: number;
  etiqueta: string;
}

export function mapaRecorrido(recorridoGeojson: string | null, marcadores: MarcadorMapa[] = []): string {
  if (!recorridoGeojson) return '';
  let coords: [number, number][];
  try {
    const g = JSON.parse(recorridoGeojson);
    coords = g?.coordinates ?? [];
  } catch {
    return '';
  }
  if (!Array.isArray(coords) || coords.length < 2) return '';

  const W = 700, H = 300, m = 20;
  const lngs = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const X = (lng: number) => m + ((lng - minLng) / Math.max(1e-9, maxLng - minLng)) * (W - 2 * m);
  const Y = (lat: number) => m + (1 - (lat - minLat) / Math.max(1e-9, maxLat - minLat)) * (H - 2 * m);

  const linea = coords.map((c, i) => `${i ? 'L' : 'M'}${X(c[0]).toFixed(1)},${Y(c[1]).toFixed(1)}`).join(' ');
  const [iniLng, iniLat] = coords[0];
  const [finLng, finLat] = coords[coords.length - 1];

  // La etiqueta se ancla del lado donde hay lugar: un destino pegado al borde
  // derecho recortaba el texto (verificado en el PDF de prueba).
  const etiqueta = (lng: number, lat: number, texto: string) => {
    const cercaDelBorde = X(lng) > W - 70;
    const dx = cercaDelBorde ? -10 : 10;
    const anchor = cercaDelBorde ? 'end' : 'start';
    return `<text x="${(X(lng) + dx).toFixed(1)}" y="${(Y(lat) + 4).toFixed(1)}" font-size="10"
      fill="${TINTA}" text-anchor="${anchor}">${texto}</text>`;
  };

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Recorrido">
    <rect width="${W}" height="${H}" fill="#F9FAFB" stroke="#E5E7EB"/>
    <path d="${linea}" fill="none" stroke="${AZUL_SERIE}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${X(iniLng).toFixed(1)}" cy="${Y(iniLat).toFixed(1)}" r="6" fill="#059669"/>
    ${etiqueta(iniLng, iniLat, 'Origen')}
    <circle cx="${X(finLng).toFixed(1)}" cy="${Y(finLat).toFixed(1)}" r="6" fill="${ROJO_ESTADO}"/>
    ${etiqueta(finLng, finLat, 'Destino')}
    ${marcadores
      .filter((m) => m.lat >= minLat && m.lat <= maxLat && m.lng >= minLng && m.lng <= maxLng)
      .map((m, i) => `<g>
        <circle cx="${X(m.lng).toFixed(1)}" cy="${Y(m.lat).toFixed(1)}" r="5" fill="none"
          stroke="${ROJO_ESTADO}" stroke-width="2"/>
        <text x="${X(m.lng).toFixed(1)}" y="${(Y(m.lat) - 9).toFixed(1)}" font-size="8"
          fill="${ROJO_ESTADO}" text-anchor="middle">${esc(m.etiqueta)}</text>
      </g>`)
      .join('')}
    <text x="${W - m}" y="${H - 8}" font-size="8" fill="${TINTA_SUAVE}" text-anchor="end">Trazado esquemático, sin cartografía de fondo</text>
  </svg>`;
}

export function renderInforme(d: DatosInforme): string {
  const r = d.resumen;
  const tiempos: Record<string, number> = r?.tiempos_por_estado ?? {};

  const filaTiempos = Object.entries(tiempos)
    .map(([estado, seg]) => `<tr><td>${esc(estado)}</td><td>${duracion(Number(seg))}</td></tr>`)
    .join('');

  const filasHistorial = d.historial
    .map((h) => `<tr>
      <td>${fecha(h.created_at)}</td>
      <td><span class="chip" style="border-color:${esc(h.color ?? '#9CA3AF')}">${esc(h.nombre_nuevo ?? h.estado_nuevo)}</span></td>
      <td>${esc(h.disparado_por)}${h.automatico ? ' (automático)' : ' (manual)'}</td>
      <td>${esc(h.causa_detalle ?? '')}</td>
    </tr>`)
    .join('');

  const filasCondiciones = d.condiciones
    .map((c) => `<tr>
      <td>${esc(c.tipo_nombre ?? c.tipo)}</td>
      <td><span class="chip" style="border-color:${esc(c.color ?? '#9CA3AF')}">${esc(c.riesgo_nombre ?? c.nivel_riesgo)}</span></td>
      <td>${fecha(c.inicio)}</td>
      <td>${c.fin ? duracion(Math.round((new Date(c.fin).getTime() - new Date(c.inicio).getTime()) / 1000)) : 'abierta'}</td>
      <td>${c.atendida ? 'Sí' : 'No'}</td>
    </tr>`)
    .join('');

  const filasAlertas = d.alertas
    .map((a) => `<tr>
      <td>${esc(a.event_type)}</td><td>${esc(a.severity)}</td>
      <td>${fecha(a.triggered_at)}</td>
      <td>${a.resolved_at ? `${fecha(a.resolved_at)} — ${esc(a.resolution_note ?? '')}` : 'sin resolver'}</td>
    </tr>`)
    .join('');

  const bloquesSensores = d.series
    .map((s) => {
      const exc = d.excursiones.filter((e) => e.sensor_type === s.sensor_type);
      const filasExc = exc
        .map((e) => {
          // Dónde ocurrió: la dirección resuelta al calcular, o las
          // coordenadas como dato duro si la geocodificación falló. Una
          // excursión en el depósito y una a mitad de ruta no son lo mismo.
          const ubicacion = e.direccion
            ? esc(e.direccion)
            : e.latitude != null
              ? `${Number(e.latitude).toFixed(5)}, ${Number(e.longitude).toFixed(5)}`
              : '—';
          return `<tr>
          <td>${fecha(e.inicio)}</td><td>${duracion(Number(e.duracion_segundos ?? 0))}</td>
          <td class="rojo">${Number(e.valor_extremo).toFixed(1)}° (${esc(e.lado)})</td>
          <td>${ubicacion}</td>
        </tr>`;
        })
        .join('');
      return `
      <h2>${s.sensor_type === 'temperature' ? 'Temperatura' : 'Humedad'} — rango objetivo ${Number(s.rango_min).toFixed(1)} a ${Number(s.rango_max).toFixed(1)}</h2>
      ${graficoSensor(s, exc)}
      <table class="kv">
        <tr><td>Tiempo fuera de rango</td><td class="${Number(s.segundos_fuera_de_rango) > 0 ? 'rojo' : ''}">${duracion(Number(s.segundos_fuera_de_rango))}</td></tr>
        <tr><td>Excursiones</td><td>${s.excursiones}</td></tr>
        <tr><td>Mínima / Máxima / Promedio</td><td>${Number(s.valor_min).toFixed(1)}° / ${Number(s.valor_max).toFixed(1)}° / ${Number(s.valor_prom).toFixed(1)}°</td></tr>
      </table>
      ${exc.length ? `<table><thead><tr><th>Inicio</th><th>Duración</th><th>Extremo</th><th>Ubicación</th></tr></thead><tbody>${filasExc}</tbody></table>` : ''}`;
    })
    .join('');

  const bloquesFotos = d.fotos
    .map((f) => {
      const dataUrl = d.fotosEmbebidas.get(f.id);
      const ubicacion =
        f.latitude != null ? `${Number(f.latitude).toFixed(5)}, ${Number(f.longitude).toFixed(5)}` : 'sin ubicación';
      return `<figure>
        ${dataUrl
          ? `<img src="${dataUrl}" alt="${esc(f.type)}"/>`
          : `<div class="foto-faltante">Foto no disponible al generar el informe (${esc(f.type)})</div>`}
        <figcaption>${esc(f.type)} · ${fecha(f.created_at)} · ${ubicacion}${f.notes ? ` · ${esc(f.notes)}` : ''}</figcaption>
      </figure>`;
    })
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <title>Informe de viaje ${esc(d.viaje.trip_code ?? d.viaje.id)}</title>
  <style>
    /* Tipografía del sistema: el PDF no puede depender de una fuente remota.
       Jerarquía en tres niveles bien separados: título del documento (22),
       título de sección (13, versalitas, con aire arriba) y contenido (11).
       Antes las secciones competían con el contenido — mismo peso visual. */
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: ${TINTA};
           margin: 32px; font-size: 11px; line-height: 1.55; }
    h1 { font-size: 22px; margin: 0 0 3px; letter-spacing: -0.01em; }
    h2 { font-size: 13px; margin: 30px 0 10px; padding-bottom: 5px;
         border-bottom: 1px solid #E5E7EB; text-transform: uppercase;
         letter-spacing: 0.06em; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
         color: ${TINTA_SUAVE}; border-bottom: 1px solid #E5E7EB; padding: 6px 10px; }
    td { padding: 7px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    .kv td:first-child { color: ${TINTA_SUAVE}; width: 40%; }
    .chip { border: 1.5px solid; border-radius: 10px; padding: 1px 8px; font-size: 10px; white-space: nowrap; }
    .rojo { color: ${ROJO_ESTADO}; font-weight: 600; }
    .encabezado { display: flex; justify-content: space-between; align-items: flex-start;
                  border-bottom: 2px solid ${TINTA}; padding-bottom: 14px; }
    .encabezado img { max-height: 48px; }
    /* El sello del sistema emisor: siempre presente, junto a la marca del tenant. */
    .sello { font-size: 9px; color: ${TINTA_SUAVE}; text-transform: uppercase;
             letter-spacing: 0.08em; margin-top: 4px; }
    figure { margin: 0 0 16px; break-inside: avoid; }
    figure img { max-width: 100%; max-height: 380px; border: 1px solid #E5E7EB; }
    figcaption { font-size: 10px; color: ${TINTA_SUAVE}; margin-top: 4px; }
    .foto-faltante { border: 1px dashed #D1D5DB; padding: 24px; text-align: center; color: ${TINTA_SUAVE}; }
    .aviso { background: #FFFBEB; border: 1px solid #FDE68A; padding: 10px 14px; font-size: 11px; }
    svg { width: 100%; height: auto; margin: 6px 0; }
    /* Sin viudas ni huérfanas: cada sección viaja con su contenido inicial.
       La sección entera intenta no partirse; si no cabe, el título nunca
       queda solo al pie — break-after: avoid lo arrastra a la página nueva. */
    section { break-inside: auto; }
    h2 { break-after: avoid; page-break-after: avoid; }
    table, figure { break-before: avoid; }
    tr { break-inside: avoid; }
    @media print { body { margin: 10mm 12mm; } }
  </style></head><body>

  <div class="encabezado">
    <div>
      <h1>Informe de viaje ${esc(d.viaje.trip_code ?? '')}</h1>
      <div>${esc(d.viaje.name ?? '')}</div>
      <div style="color:${TINTA_SUAVE}">Generado el ${new Date().toLocaleString('es-AR')}</div>
    </div>
    <div style="text-align:right">
      ${d.logoDataUrl ? `<img src="${d.logoDataUrl}" alt="logo"/>` : ''}
      <div style="font-weight:700">${esc(d.viaje.tenant_nombre)}</div>
      <div class="sello">Rusertech — Seguridad &amp; Logística</div>
    </div>
  </div>

  <h2>Datos del viaje</h2>
  <table class="kv">
    <tr><td>Vehículo</td><td>${esc(d.viaje.plate ?? '—')} ${d.viaje.alias ? `(${esc(d.viaje.alias)})` : ''}</td></tr>
    <tr><td>Conductor</td><td>${esc(d.viaje.conductor ?? '—')}</td></tr>
    <tr><td>Transportista</td><td>${esc(d.viaje.transportista ?? '—')}</td></tr>
    <tr><td>Origen → Destino</td><td>${esc(d.viaje.origin_name ?? '—')} → ${esc(d.viaje.destination_name ?? '—')}</td></tr>
    <tr><td>Planificado</td><td>${fecha(d.viaje.planned_start)} → ${fecha(d.viaje.planned_end)}</td></tr>
    <tr><td>Real</td><td>${fecha(d.viaje.actual_start)} → ${fecha(d.viaje.actual_end)}</td></tr>
    ${r?.cumplimiento_ventana != null
      ? `<tr><td>Cumplimiento</td><td class="${r.cumplimiento_ventana ? '' : 'rojo'}">
           ${r.cumplimiento_ventana ? 'Dentro de la ventana planificada' : `Fuera de la ventana por ${r.minutos_fuera_ventana} min`}</td></tr>`
      : ''}
  </table>

  ${r
    ? `<h2>Resumen</h2>
  <table class="kv">
    <tr><td>Kilómetros recorridos</td><td>${Number(r.km_recorridos ?? 0).toFixed(1)} km</td></tr>
    <tr><td>Velocidad máxima / promedio</td><td>${r.vel_maxima_kmh ?? '—'} / ${r.vel_promedio_kmh ?? '—'} km/h</td></tr>
    <tr><td>Duración total</td><td>${esc(r.duracion_total ?? '—')}</td></tr>
    <tr><td>En marcha / detenido</td><td>${esc(r.tiempo_en_marcha ?? '—')} / ${esc(r.tiempo_detenido ?? '—')}</td></tr>
    <tr><td>Paradas declaradas / no declaradas</td>
        <td>${r.paradas_declaradas} / <span class="${r.paradas_no_declaradas > 0 ? 'rojo' : ''}">${r.paradas_no_declaradas}</span></td></tr>
    <tr><td>Eventos (SOS / incidentes / checkpoints)</td>
        <td>${r.eventos_sos} / ${r.eventos_incidente} / ${r.eventos_checkpoint}</td></tr>
  </table>
  ${filaTiempos ? `<h2>Tiempos por estado</h2><table><thead><tr><th>Estado</th><th>Tiempo</th></tr></thead><tbody>${filaTiempos}</tbody></table>` : ''}
  ${d.mapaEstatico
    ? `<figure style="break-inside:avoid">
         <img src="${d.mapaEstatico}" alt="Recorrido" style="width:100%;border:1px solid #E5E7EB"/>
         <figcaption>Recorrido con origen, destino y excursiones de temperatura ·
           cartografía © MapTiler © OpenStreetMap contributors</figcaption>
       </figure>`
    : mapaRecorrido(
        r.recorrido_geojson,
        d.excursiones
          .filter((e) => e.latitude != null)
          .map((e) => ({
            lat: Number(e.latitude),
            lng: Number(e.longitude),
            etiqueta: `${Number(e.valor_extremo).toFixed(0)}°`,
          })),
      )}`
    : `<div class="aviso">El resumen de este viaje todavía no se calculó. Se genera automáticamente al
       cerrarlo; si el viaje ya está cerrado, puede recalcularse desde la pantalla del viaje.</div>`}

  ${filasHistorial
    ? `<h2>Línea de tiempo de estados</h2>
  <table><thead><tr><th>Momento</th><th>Estado</th><th>Disparado por</th><th>Detalle</th></tr></thead>
  <tbody>${filasHistorial}</tbody></table>`
    : ''}

  ${bloquesSensores}

  ${filasCondiciones
    ? `<h2>Condiciones registradas</h2>
  <table><thead><tr><th>Condición</th><th>Riesgo</th><th>Inicio</th><th>Duración</th><th>Atendida</th></tr></thead>
  <tbody>${filasCondiciones}</tbody></table>`
    : ''}

  ${filasAlertas
    ? `<h2>Alertas</h2>
  <table><thead><tr><th>Tipo</th><th>Severidad</th><th>Disparada</th><th>Resolución</th></tr></thead>
  <tbody>${filasAlertas}</tbody></table>`
    : ''}

  ${bloquesFotos ? `<h2>Evidencia fotográfica</h2>${bloquesFotos}` : ''}

  </body></html>`;
}
