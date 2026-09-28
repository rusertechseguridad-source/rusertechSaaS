import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Campana } from './Campana';
import { useCampanaStore, type Aviso } from '../../store/campanaStore';
import { useBitacoraStore } from '../../store/bitacoraStore';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL CABLEADO DE LA PANTALLA — a qué URL se pide cuando se toca el botón
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ POR QUÉ ESTA SUITE EXISTE, Y POR QUÉ RECIÉN AHORA.
 *
 * `apps/web` no tenía ninguna prueba. Ni una. Lo único que miraba el frontend
 * era `tsc -b --force` —tipos, no comportamiento— y una afirmación de
 * contenido del ZIP:
 *
 *     Campana.tsx :: CONTIENE :: await abrirBitacora(aviso)
 *
 * Esa afirmación PASÓ mientras el botón no pedía el protocolo. Y tenía que
 * pasar: comprueba que una cadena esté escrita en un archivo, no que el clic
 * la ejecute. Es la misma falla que la 3A —`recalcular()` con 31 pruebas y
 * ningún llamador— del otro lado del cable, donde ninguna regla miraba.
 *
 * ⚠️ POR ESO SE RENDERIZA EL COMPONENTE Y SE HACE CLIC DE VERDAD. Una prueba
 * que importara el store y llamara a `abrir()` a mano volvería a probar la
 * función sin probar el camino, que es exactamente el error que se corrige.
 * Lo que se afirma es la URL que salió, porque es lo único que demuestra que
 * el botón llegó al backend correcto.
 *
 * ── Las reversiones que la sostienen ──────────────────────────────────────
 *
 *   G · Volver `atenderAviso` al camino viejo (`campanaStore.atender`)
 *       → cae «pide el PROTOCOLO y no la lista de alertas».
 *   H · Que el botón no llame a nada (`onAtender={() => {}}`)
 *       → caen las mismas, y además la del modal.
 *   I · `registrar` con POST en vez de PUT          → cae «Registrar y atender».
 *   J · `escalar` con PUT en vez de POST            → cae «Escalar a …».
 *   K · `cerrarAlerta` con PUT en vez de POST       → cae «Confirmar cierre».
 *   L · `onEscalar` del modal sin llamar a `escalar` → cae «Escalar a …».
 *       Cada una tumba UNA prueba, la suya. J era el hueco medido: con el
 *       verbo roto pasaban las 13 de acá y las 10 del navegador.
 */

const ALERTA = 'cccc0001-0000-4000-8000-000000000001';

const CRITICA: Aviso = {
  fuente: 'condicion',
  id: ALERTA,
  tenant_id: '11111111-1111-1111-1111-111111111111',
  vehicle_id: 'aaaa0001-0000-4000-8000-000000000001',
  trip_id: null,
  tipo: 'SIN_REPORTE',
  titulo: 'Sin reporte',
  nivel_riesgo: 'CRITICO',
  color: '#c0202e',
  interrumpe: true,
  requiere_atencion: true,
  clasificado: true,
  // 20:19:51 hora de Buenos Aires — la hora con la que se descubrió que el
  // formato de 12 horas convertía un incidente de la noche en uno de la mañana.
  ocurrio_at: '2026-09-22T23:19:51.000Z',
  patente: 'DEMO-001',
  latitud: -34.6,
  longitud: -58.4,
  ubicacion_at: '2026-09-22T23:10:00.000Z',
  lugar: null,
  direccion: 'Av. Siempreviva 742',
  disparador: '50 minutos sin reportar',
};

const PROTOCOLO = {
  existe: true,
  cerrada: false,
  tipo_condicion: 'SIN_REPORTE',
  pasos: [{ id: 'p1', orden: 1, accion: 'Llamar al conductor' }],
  resultados: [
    { codigo: 'NO_RESPONDE', nombre: 'No responde', orden: 3, habilita_escalada: true },
  ],
  propio_del_cliente: false,
  motivo_sin_permiso_critica: null,
  puede_cerrar: false,
  destino_de_escalada: {
    usuario_id: 'uuuu0002-0000-4000-8000-000000000002',
    nombre: 'Gerente Demo',
    email: 'g@demo',
    role_code: 'manager',
    nivel_jerarquico: 90,
  },
};

/**
 * Un `fetch` de mentira que ANOTA TODAS LAS URLs pedidas.
 *
 * ⚠️ El flujo devuelve un cuerpo que se cierra solo. Uno infinito dejaría la
 * prueba colgada; uno que falla haría que el store programe un reintento con
 * `setTimeout`, y el corredor se quedaría esperándolo.
 */
function armarFetch(sobre: Record<string, unknown> = {}) {
  const pedidas: string[] = [];
  // ⚠️ La URL sola no alcanza para lo que ESCRIBE: la ruta de escalar existe
  // por POST, y un PUT a la misma URL da 404. Se anota el verbo y el cuerpo.
  const envios: { url: string; metodo: string; cuerpo: Record<string, unknown> | null }[] = [];
  const cuerpoVacio = () =>
    new ReadableStream({ start(c) { c.close(); } });

  const doble = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    pedidas.push(u);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    if (metodo !== 'GET') {
      envios.push({ url: u, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
    }
    for (const [clave, valor] of Object.entries(sobre)) {
      if (u.includes(clave)) return valor as Response;
    }
    if (u.includes('/campana/flujo')) {
      return { ok: true, status: 200, body: cuerpoVacio() } as unknown as Response;
    }
    if (u.includes('/campana/pendientes')) {
      return respuesta([CRITICA]);
    }
    if (u.includes('/protocolo')) return respuesta(PROTOCOLO);
    if (u.includes('/hilo')) return respuesta([]);
    return respuesta({});
  });

  vi.stubGlobal('fetch', doble);
  return { pedidas, envios };
}

const respuesta = (datos: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => datos,
    text: async () => JSON.stringify(datos),
  }) as unknown as Response;

/** Deja los stores como recién arrancados: son globales entre pruebas. */
beforeEach(() => {
  useCampanaStore.setState({
    avisos: [], conexion: 'conectando', ultimoLatido: null,
    cargando: false, error: null, panelAbierto: false,
  });
  useBitacoraStore.setState({
    abierta: null, protocolo: null, hilo: [],
    cargando: false, guardando: false, error: null,
  });
});

describe('Campana · el botón «Atender» está ENCHUFADO', () => {
  it('🔴 pide el PROTOCOLO de la alerta y no la lista de alertas', async () => {
    // ⚠️ ESTA ES LA PRUEBA QUE FALTABA. La afirmación del ZIP comprobaba que
    // el archivo nombrara `abrirBitacora`; esto comprueba que el clic termine
    // en `/api/v1/bitacora/<id>/protocolo`.
    const { pedidas } = armarFetch();
    render(<Campana />);

    const boton = await screen.findByRole('button', { name: /Atender esta alerta/i });
    pedidas.length = 0; // se descartan las del montaje: interesa lo que produce el clic
    await userEvent.click(boton);

    await waitFor(() => {
      expect(pedidas.some((u) => u.includes(`/api/v1/bitacora/${ALERTA}/protocolo`))).toBe(true);
    });
    // Y NO la lista de alertas, que es a dónde iba a parar.
    expect(pedidas.some((u) => u.includes('/api/v1/alerts'))).toBe(false);
  });

  it('🔴 y también pide el HILO, con la misma fuente', async () => {
    // El formulario sin el hilo le pide al operador que decida sin lo que ya
    // está en el sistema, y termina repitiendo un paso que otro hizo.
    const { pedidas } = armarFetch();
    render(<Campana />);

    const boton = await screen.findByRole('button', { name: /Atender esta alerta/i });
    await userEvent.click(boton);

    await waitFor(() => {
      expect(pedidas.some((u) => u.includes(`/api/v1/bitacora/${ALERTA}/hilo?fuente=condicion`))).toBe(true);
    });
  });

  it('🔴 el formulario aparece en pantalla, no sólo la petición', async () => {
    // Una petición que sale y una pantalla que no muestra nada es el estado
    // que se reportó. Se comprueban las dos cosas.
    armarFetch();
    render(<Campana />);

    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));

    expect(await screen.findByText('Llamar al conductor')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Registrar y atender/i })).toBeInTheDocument();
  });
});

describe('Campana · lo que la bitácora ESCRIBE llega al backend con su verbo', () => {
  /**
   * ⚠️ HASTA ACÁ, NINGUNA PRUEBA ENVIABA NADA. Las de arriba y las del
   * navegador cubren ABRIR la bitácora y cómo se dibuja; registrar, escalar y
   * cerrar se habían probado sólo a mano. Y la regla R20 del backend, que mira
   * las URLs, no puede ver que el BOTÓN llame a la función: eso es
   * comportamiento, y se prueba haciendo clic.
   *
   * Se afirma URL Y MÉTODO de lo que sale. La URL sola no alcanza: la de
   * escalar existe por POST, y un PUT a la misma dirección da 404.
   */
  async function abrirLaBitacora() {
    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));
    await screen.findByRole('dialog');
  }

  it('🔴 «Registrar y atender» hace PUT a /campana/<id>/atender, con lo elegido', async () => {
    const { envios } = armarFetch();
    render(<Campana />);
    await abrirLaBitacora();

    await userEvent.click(await screen.findByRole('radio', { name: /No responde/i }));
    await userEvent.click(screen.getByRole('button', { name: /Registrar y atender/i }));

    await waitFor(() => expect(envios).toHaveLength(1));
    expect(envios[0].url).toContain(`/api/v1/campana/${ALERTA}/atender`);
    expect(envios[0].metodo).toBe('PUT');
    // Lo que el operador eligió viaja: si no, el servidor rechaza con «elegí
    // un resultado» a alguien que ya lo eligió.
    expect(envios[0].cuerpo).toMatchObject({ fuente: 'condicion', resultado_codigo: 'NO_RESPONDE' });
  });

  it('🔴 «Escalar a …» hace POST a /bitacora/<id>/escalar', async () => {
    const { envios } = armarFetch();
    render(<Campana />);
    await abrirLaBitacora();

    await userEvent.click(await screen.findByRole('button', { name: /Escalar a Gerente Demo/i }));

    await waitFor(() => expect(envios).toHaveLength(1));
    expect(envios[0].url).toContain(`/api/v1/bitacora/${ALERTA}/escalar`);
    expect(envios[0].metodo).toBe('POST');
    expect(envios[0].cuerpo).toMatchObject({ fuente: 'condicion' });
  });

  it('🔴 «Confirmar cierre» hace POST a /bitacora/<id>/cerrar, con el motivo escrito', async () => {
    // Cerrar es facultad de un superior: con `puede_cerrar` en falso el
    // botón ni aparece, así que el protocolo de esta prueba lo habilita.
    const { envios } = armarFetch({ '/protocolo': respuesta({ ...PROTOCOLO, puede_cerrar: true }) });
    render(<Campana />);
    await abrirLaBitacora();

    await userEvent.click(await screen.findByRole('button', { name: /Cerrar esta alerta/i }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/i), 'El cliente confirmó que siguió normal');
    await userEvent.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    await waitFor(() => expect(envios).toHaveLength(1));
    expect(envios[0].url).toContain(`/api/v1/bitacora/${ALERTA}/cerrar`);
    expect(envios[0].metodo).toBe('POST');
    expect(envios[0].cuerpo).toMatchObject({
      fuente: 'condicion',
      motivo: 'El cliente confirmó que siguió normal',
    });
  });
});

describe('Campana · los tres estados se distinguen en pantalla', () => {
  it('🔴 mientras carga, lo dice', async () => {
    // Nunca resuelve: es el estado «pedí y todavía no volvió».
    let liberar: (r: Response) => void = () => {};
    armarFetch({ '/protocolo': undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/campana/flujo')) {
        return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.close(); } }) } as unknown as Response;
      }
      if (u.includes('/campana/pendientes')) return respuesta([CRITICA]);
      if (u.includes('/protocolo')) return new Promise<Response>((r) => { liberar = r; });
      if (u.includes('/hilo')) return respuesta([]);
      return respuesta({});
    }));

    render(<Campana />);
    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));

    expect(await screen.findByText(/Buscando el protocolo/i)).toBeInTheDocument();
    liberar(respuesta(PROTOCOLO));
  });

  it('🔴 sin permiso, muestra EL MOTIVO y no esconde el formulario', async () => {
    // Un botón ausente es indistinguible de una función que no existe.
    armarFetch({
      '/protocolo': respuesta({
        ...PROTOCOLO,
        motivo_sin_permiso_critica:
          'Necesitás el permiso «Atender Alertas Críticas». Pedíselo a un supervisor.',
      }),
    });
    render(<Campana />);

    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));

    expect(await screen.findByText(/Atender Alertas Críticas/)).toBeInTheDocument();
    // El formulario SE VE, deshabilitado. No desaparece.
    expect(await screen.findByRole('button', { name: /Registrar y atender/i })).toBeDisabled();
  });

  it('🔴 si no se pudo cargar, lo dice — y no se queda en blanco', async () => {
    // Es el estado que se reportó como «no aparece nada»: sin este mensaje,
    // un fallo del servidor y una pantalla rota se ven exactamente igual.
    armarFetch({ '/protocolo': respuesta({ message: 'se cayó' }, 500) });
    render(<Campana />);

    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));

    // ⚠️ Se afirma EL MOTIVO DEL SERVIDOR y no una frase genérica: si la
    // pantalla mostrara «no se pudo» a secas, el operador quedaría probando
    // el botón otra vez sin saber qué pasó. `mensajeDeError` prefiere el
    // mensaje del backend por encima del texto por código, y eso es lo que
    // esta prueba fija.
    expect(await screen.findByText(/se cayó/i)).toBeInTheDocument();
  });
});

describe('Campana · la hora va en 24 horas', () => {
  it('🔴 una alerta de las 20:19 NO se muestra como 08:19', async () => {
    // ⚠️ En custodia, un incidente de la noche registrado como de la mañana
    // hace que el operador le dicte al cliente la hora equivocada. El formato
    // de 12 horas sin AM/PM es indistinguible de uno de 24 mal leído.
    armarFetch();
    render(<Campana />);

    // ⚠️ Se apunta al campo «Cuándo», no al primer texto con «2026»: desde
    // que el aviso muestra la hora de la POSICIÓN, hay dos fechas en pantalla,
    // y un localizador ambiguo falla por ambiguo — no por el formato.
    const etiqueta = await screen.findByText('Cuándo');
    const cuando = etiqueta.nextElementSibling!;
    expect(cuando.textContent).toMatch(/20:19/);
    expect(cuando.textContent).not.toMatch(/\b08:19\b/);
  });
});

describe('Campana · el aviso crítico se minimiza, no se cierra', () => {
  it('🔴 se puede minimizar para poder navegar', async () => {
    // ⚠️ EL BLOQUEO CIRCULAR MEDIDO: con una crítica en pantalla, el admin no
    // podía llegar a Gestión de Usuarios a otorgar el permiso que hace falta
    // para atenderla. La superposición tiene que poder correrse.
    armarFetch();
    render(<Campana />);

    await userEvent.click(await screen.findByRole('button', { name: /Minimizar/i }));

    // Ya no hay superposición que tape la pantalla…
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // …pero la alerta SIGUE VISIBLE en una franja, y sigue pudiéndose atender.
    // ⚠️ Nombre exacto: /Atender/i también casaba con «Minimizar — sigue sin
    // atender», y una prueba que casa con dos botones no dice cuál quedó.
    expect(await screen.findByRole('button', { name: 'Atender' })).toBeInTheDocument();
  });

  it('🔴 NO hay forma de descartarla sin atenderla', async () => {
    // Minimizar no es silenciar. Una crítica sin atender no puede
    // desaparecer con una X: sería exactamente lo que la bitácora vino a
    // impedir, con un clic en vez de con un INSERT.
    armarFetch();
    render(<Campana />);

    await userEvent.click(await screen.findByRole('button', { name: /Minimizar/i }));

    expect(screen.queryByRole('button', { name: /Descartar|Cerrar el aviso/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/DEMO-001/)).toBeInTheDocument();
  });
});

describe('Campana · las superposiciones ESCAPAN de la barra superior', () => {
  /**
   * ══════════════════════════════════════════════════════════════════════
   * ⚠️ LO QUE ESTAS PRUEBAS PUEDEN VER, Y LO QUE NO — dicho antes de leerlas
   * ══════════════════════════════════════════════════════════════════════
   *
   * jsdom NO TIENE MOTOR DE DISPOSICIÓN. Lo medí en este mismo entorno, con
   * un `div` de 500×300 declarado a mano:
   *
   *   getBoundingClientRect() → { w: 0, h: 0, top: 0, left: 0 }
   *   offsetWidth / offsetHeight → 0 / 0
   *   document.elementFromPoint → undefined (no existe)
   *
   * O sea: NINGUNA prueba de acá puede comprobar que algo esté en pantalla,
   * que tape a otra cosa, ni que se pueda leer. `getByText` encuentra el
   * elemento aunque esté a tres mil píxeles de distancia o tapado por otro.
   * Las 9 pruebas de arriba pasaban con razón mientras el modal era inusable.
   *
   * ⚠️ PERO ESTE DEFECTO SÍ SE PUEDE CAZAR ACÁ, y es lo que hace útil a este
   * bloque: la causa no era de disposición sino de ESTRUCTURA. La campana
   * vive adentro de un `<nav>` con `backdrop-blur`, y ese filtro convierte al
   * nav en bloque contenedor de sus descendientes `position: fixed`. «¿De
   * quién cuelga el modal?» es un hecho del DOM, no de la pantalla.
   *
   * La medición que lo estableció, en Chromium de verdad:
   *   fixed inset-0 dentro de un ancestro con backdrop-filter → 1200 × 64
   *   el mismo, sin backdrop-filter                           → 1200 × 800
   *
   * Lo que sigue necesitando un navegador —posición, solapamiento, que el
   * hilo se pueda desplazar de verdad— está en `pruebas-navegador/`.
   */
  function montarDentroDeLaBarra() {
    // Reproduce la cadena real: `AppLayout` monta `<Campana />` adentro de
    // `<nav class="… backdrop-blur-md …">`.
    const barra = document.createElement('nav');
    barra.className = 'backdrop-blur-md';
    document.body.appendChild(barra);
    return render(<Campana />, { container: barra });
  }

  it('🔴 el aviso crítico NO cuelga de la barra con backdrop-blur', async () => {
    armarFetch();
    montarDentroDeLaBarra();

    const aviso = await screen.findByRole('alertdialog');
    const barra = document.querySelector('nav.backdrop-blur-md')!;
    // ⚠️ Si colgara de la barra, `fixed inset-0` mediría 64 px de alto y el
    // fondo oscurecido taparía sólo el encabezado — con el mapa nítido
    // detrás de una alerta crítica.
    expect(barra.contains(aviso)).toBe(false);
    expect(aviso.parentElement).toBe(document.body);
  });

  it('🔴 el modal de atención tampoco', async () => {
    armarFetch();
    montarDentroDeLaBarra();

    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));

    const modal = await screen.findByRole('dialog');
    expect(document.querySelector('nav.backdrop-blur-md')!.contains(modal)).toBe(false);
    expect(modal.parentElement).toBe(document.body);
  });

  it('🔴 y la franja minimizada tampoco — era la que más engañaba', async () => {
    // Declarada `bottom-0`, se dibujaba ARRIBA: el borde inferior de la
    // barra, no el de la pantalla. Parecía funcionar.
    armarFetch();
    montarDentroDeLaBarra();

    await userEvent.click(await screen.findByRole('button', { name: /Minimizar/i }));

    const franja = await screen.findByRole('status');
    expect(document.querySelector('nav.backdrop-blur-md')!.contains(franja)).toBe(false);
  });

  it('🔴 el cuerpo del modal tiene desplazamiento propio y altura acotada', async () => {
    // ⚠️ ESTO ES ESTRUCTURA, NO DISPOSICIÓN, y conviene no confundirlo: se
    // comprueba que las clases estén, no que el desplazamiento funcione. Que
    // funcione lo mira el navegador. Sin las clases no puede funcionar, así
    // que sirve como piso — y el hilo CRECE con cada entrada: sin altura
    // acotada, la quinta empuja los botones fuera de la vista justo cuando
    // más trabajo se registró.
    armarFetch();
    montarDentroDeLaBarra();

    await userEvent.click(await screen.findByRole('button', { name: /Atender esta alerta/i }));
    const modal = await screen.findByRole('dialog');

    const caja = modal.querySelector('div')!;
    expect(caja.className).toMatch(/max-h-/);
    expect(caja.className).toMatch(/flex-col/);
    expect(modal.querySelector('.overflow-y-auto')).not.toBeNull();
  });
});
