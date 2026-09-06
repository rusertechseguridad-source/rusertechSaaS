# Desplegar Rusertech

Qué hace falta para que la aplicación corra en un servidor y no en la máquina
de alguien. Escrito para leerse de arriba a abajo la primera vez, y como
referencia después.

**Regla que rige todo esto:** la API se niega a arrancar si falta algo crítico,
y lo dice todo junto en un solo mensaje. Si arranca, la configuración da.

---

## 1 · Antes de tocar nada: qué hay que tener

| Pieza | Obligatorio | Notas |
|---|---|---|
| Postgres (Supabase) | sí | Ya existe. Sólo cambia la URL de conexión. |
| Cuenta de Resend con **dominio verificado** | sí, antes del primer cliente | Sin esto ningún usuario invitado recibe su contraseña. |
| Redis (Upstash) | no | Sin él la aplicación funciona; quedan sin servicio tres colas. |
| Un dominio o subdominio para la API | sí | Puede ser el mismo que el del frontend. |

---

## 2 · Variables del BACKEND (`apps/api`)

### Obligatorias — sin ellas la API no arranca

| Variable | Qué es | Qué pasa si falta |
|---|---|---|
| `DATABASE_URL` | Conexión que usa toda la aplicación. | **No arranca.** Mensaje: falta `DATABASE_URL`. |
| `JWT_SECRET` | Firma los tokens de sesión. | **No arranca.** Antes existía un valor por defecto que está en el repositorio: con él, cualquiera firmaba tokens válidos de cualquier usuario de cualquier cliente. Por eso ya no hay valor por defecto. |
| `JWT_REFRESH_SECRET` | Firma los tokens de refresco. | **No arranca.** |
| `CREDENTIALS_ENCRYPTION_KEY` | Cifra las credenciales de terceros guardadas en la base. | **No arranca.** Y si se cambia sin dejar la anterior en `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`, las credenciales ya guardadas dejan de poder leerse. |

Generá cada secreto con `openssl rand -base64 48` (la clave de cifrado con
`openssl rand -base64 32`, que son exactamente 32 bytes).

⚠️ Los valores `changeme_…` del `.env.example` **se rechazan al arrancar**.
Están en el repositorio, así que son tan públicos como escribirlos en el
código.

### Obligatorias en producción (`NODE_ENV=production`)

| Variable | Qué es | Qué pasa si falta |
|---|---|---|
| `CORS_ORIGIN` | Orígenes que la API acepta, separados por comas. | **No arranca en producción.** Si arrancara, aceptaría sólo `localhost:5173` y el navegador del cliente bloquearía todas las llamadas — con una pantalla en blanco como único síntoma. |
| `PUBLIC_API_URL` | La dirección con la que un navegador llega a esta API. | **No arranca en producción.** Si arrancara, las fotos subidas devolverían URLs apuntando a `localhost` de quien las mire. |

Formato de `CORS_ORIGIN`: `esquema://host[:puerto]`, **sin ruta ni barra
final** — el navegador compara la cadena exacta. `*` se rechaza: con
`credentials: true` el navegador descarta la respuesta igual, así que
aceptarlo sería prometer algo que no ocurre.

```bash
CORS_ORIGIN="https://app.midominio.com"
PUBLIC_API_URL="https://api.midominio.com"
```

### Opcionales — la aplicación arranca y avisa qué queda degradado

| Variable | Qué es | Qué pasa si falta |
|---|---|---|
| `DIRECT_URL` | Conexión directa (5432), sin pooler. | Aviso. La aplicación no la usa para servir tráfico; sin ella no funcionan `prisma db pull` ni la introspección. |
| `RESEND_API_KEY` | Clave de Resend. | Aviso. **No se envía ningún correo**: un usuario invitado no recibe su contraseña y hay que regenerársela a mano. |
| `MAIL_FROM` | Remitente. | Aviso. Se usa el dominio de prueba de Resend, que sólo entrega a la dirección dueña de la cuenta. |
| `APP_URL` | Dirección del **frontend**. | El botón "Ingresar" del correo de invitación apunta a `localhost:5173`. |
| `REDIS_URL` | Redis. | Aviso. Quedan sin servicio: huella de carbono, reenvío de posiciones y simulador de rutas. |
| `REDIS_TOKEN` | Token de Upstash. | Obligatorio **sólo** si `REDIS_URL` es una `https://` (ver abajo). |
| `TRUST_PROXY` | `"true"` si hay un proxy de confianza delante. | El límite de peticiones cuenta por la IP del balanceador en vez de por la del cliente. |
| `PORT` | Puerto de escucha. | 3000. |

---

## 3 · Variables del FRONTEND (`apps/web`)

Una sola, y tiene dos particularidades que conviene saber antes:

```bash
VITE_API_URL="https://api.midominio.com"
```

⚠️ **Se resuelve al COMPILAR, no al arrancar.** Vite reemplaza el valor dentro
del bundle. Cambiarla exige volver a correr `npm run build`; reiniciar no hace
nada.

⚠️ **Sólo las variables `VITE_` llegan al navegador, y son públicas.** Nunca
pongas una clave ahí.

Tres escenarios:

| Situación | Valor |
|---|---|
| Desarrollo | No la definas. Vale `http://localhost:3000`. |
| API en su propio dominio | `VITE_API_URL="https://api.midominio.com"` |
| API y frontend detrás del mismo dominio | `VITE_API_URL=""` — cadena **vacía**, deja todas las llamadas relativas. |

El tercer caso es la razón de que el código use `??` y no `||`: con `||`, una
cadena vacía deliberada caería al valor de desarrollo y rompería el despliegue
justo en el caso que la variable viene a cubrir.

---

## 4 · Correo: lo que hay que hacer antes del primer cliente

Hoy la cuenta de Resend está **en modo de prueba**. Verificado en vivo:

```
You can only send testing emails to your own email address
(rusertechseguridad@gmail.com). To send emails to other recipients,
please verify a domain at resend.com/domains
```

O sea: **ningún usuario invitado recibe su contraseña.** El código ya está
listo; lo que falta es una tarea en el panel de Resend:

1. Entrar a <https://resend.com/domains> y agregar el dominio.
2. Cargar los registros DNS que Resend indique (SPF y DKIM) en el proveedor
   del dominio.
3. Esperar a que Resend lo marque como verificado.
4. Poner el remitente en `MAIL_FROM`:
   ```bash
   MAIL_FROM="Rusertech <no-responder@midominio.com>"
   ```
5. Reiniciar la API. El aviso de "dominio de prueba" tiene que desaparecer del
   arranque.

**Cómo comprobar que salió, sin adivinar.** Invitá un usuario a una dirección
que NO sea la dueña de la cuenta. La respuesta de la API trae ahora
`emailSent`, y si es `false` viene además `emailError` con el motivo. Antes
esto siempre decía `true`: el SDK de Resend no lanza cuando la API rechaza el
envío —resuelve con `{ data: null, error }`— así que el `try/catch` no veía
nada. Ese era el defecto real, no la ausencia del indicador.

Si un correo no sale, el log de la API trae el motivo y la contraseña se
regenera con `POST /admin/users/:id/reset-password`.

---

## 5 · Redis: el formato de la URL

Upstash muestra **dos** direcciones y son cosas distintas:

| Lo que muestra | Qué es |
|---|---|
| `https://<algo>.upstash.io` | API REST. Se habla con `fetch` y un token. |
| `rediss://default:<token>@<algo>.upstash.io:6379` | Protocolo Redis. |

`ioredis` y BullMQ hablan **la segunda**. Si ponés la primera, la aplicación
puede convertirla, pero necesita `REDIS_TOKEN`; sin el token **no arranca** y
dice exactamente eso.

Antes no decía nada: abría el cliente igual, cada comando quedaba encolado
esperando una conexión que no llegaba, el pedido HTTP que lo disparó no
terminaba nunca y retenía su conexión de Prisma. Con suficientes pedidos así el
pool se agotaba y la API dejaba de responder **entera**, incluidas las rutas que
no tocan Redis. Ahora los comandos fallan en segundos en vez de colgarse
(`maxRetriesPerRequest: 2`, `enableOfflineQueue: false`, `connectTimeout: 5s`).

**Lo más simple es usar directamente la `rediss://`** y no definir
`REDIS_TOKEN`.

Dejar `REDIS_URL` vacía es una opción válida y completa: la aplicación
funciona sin Redis.

---

## 6 · El puerto del pooler: cómo probarlo sin riesgo

**Estado actual:** `DATABASE_URL` apunta al **5432** con `pgbouncer=true`.
Corresponde el **6543**.

**Por qué no lo cambié yo.** Hoy funciona. Un cambio de puerto que salga mal
deja el sistema sin base, y no tengo forma de comprobar desde acá que el 6543
acepta la conexión con esas credenciales. La aplicación **avisa** al arrancar
y no toca nada.

**Qué está pasando ahora mismo.** El 5432 es la conexión **directa** de
Supabase. `pgbouncer=true` le dice a Prisma que no use prepared statements
nombrados — una precaución que el pooler necesita y la conexión directa no. O
sea que hoy no hay pooler: hay una conexión directa comportándose como si lo
hubiera. Funciona con una instancia; con varias réplicas, el proyecto se queda
sin conexiones.

`connection_limit=10` tampoco se está aplicando: Prisma reporta 21, que es
`(núcleos × 2 + 1)` en una máquina de 10 núcleos, o sea el valor por defecto.
Eso confirma que el parámetro **no está en la URL en uso**, aunque sí esté en
`.env.example`.

### Procedimiento

**Paso 1 — Conseguir la URL correcta.** En Supabase → Project Settings →
Database → Connection string → **Transaction pooler**. Tiene puerto `6543` y el
usuario con la forma `postgres.<project_ref>`, distinto del de la conexión
directa. Agregale los dos parámetros:

```
postgresql://postgres.rudaqsfgjorryuqayqyd:CLAVE@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
```

**Paso 2 — Probarla SIN tocar la aplicación.** Desde la máquina donde corre la
API:

```bash
psql "postgresql://postgres.rudaqsfgjorryuqayqyd:CLAVE@aws-0-REGION.pooler.supabase.com:6543/postgres" -c "select 1"
```

Si esto no devuelve `1`, no sigas: el problema es de credenciales o de red, y
la aplicación no tiene nada que ver.

**Paso 3 — Probarla con la aplicación, sin exponerla.** Levantá una segunda
instancia en otro puerto, con la URL nueva, sin tocar la que está sirviendo:

```bash
DATABASE_URL="...6543...&pgbouncer=true&connection_limit=10" PORT=3001 npm run start:prod
```

Y consultá su chequeo de salud:

```bash
curl -s localhost:3001/health | jq
```

Tiene que decir `"estado": "ok"` y `base_de_datos.ok: true`. Probá también una
consulta real con sesión (entrar y pedir el mapa): los errores de prepared
statements aparecen **bajo concurrencia**, no en la primera consulta.

**Paso 4 — Cambiar.** Recién ahí, poné la URL nueva en el `.env` de la
instancia real y reiniciá. Si algo sale mal, volver es cambiar la variable de
nuevo y reiniciar: no hay ningún dato migrado, sólo una cadena de conexión.

**Paso 5 — Comprobar que `connection_limit` ahora sí se aplica.**

```sql
select count(*) from pg_stat_activity where usename like 'postgres%';
```

Tiene que quedar por debajo de 10 por instancia, no en 21.

---

## 7 · Chequeo de salud

| Ruta | Para qué | Toca la base |
|---|---|---|
| `GET /health/vivo` | ¿El proceso está vivo? `livenessProbe`. | No |
| `GET /health` | ¿Puede atender? `readinessProbe`. | Sí |

Las dos son **públicas y sin autenticación**: quien chequea salud es una
máquina que no tiene credenciales. Por eso la respuesta no incluye versiones,
cadenas de conexión ni errores crudos de la base.

`GET /health` devuelve `200` si la base responde y `503` si no. **Redis caído
no lo tumba**: la instancia sigue siendo útil (las posiciones en vivo salen de
Postgres), así que informa `"estado": "degradado"` y responde 200. Un 503 ahí
haría que el balanceador sacara de rotación una instancia sana.

```json
{
  "estado": "ok",
  "base_de_datos": { "ok": true, "ms": 12 },
  "redis": { "ok": null, "ms": null, "detalle": "no configurado" },
  "tiempo_encendido_s": 341
}
```

---

## 8 · Límite de peticiones

| Ruta | Límite | Por |
|---|---|---|
| `POST /auth/login` | 10 cada 5 minutos | origen |
| `POST /api/v1/telemetry/ingest` | 600 por minuto | origen |

Al pasarse: `429` con el tiempo de espera en el mensaje.

⚠️ **El contador vive en la memoria del proceso.** Con una sola instancia es
exacto. Con varias réplicas, cada una lleva su cuenta y el límite efectivo se
multiplica por la cantidad de instancias. Cuando haya más de una, esto tiene
que mudarse a un contador en Redis. Se hizo así, y no con `@nestjs/throttler`,
para no sumar una dependencia en la misma tanda que saca cuatro; son ~70
líneas y se prueban sin levantar Nest.

⚠️ Detrás de un balanceador hay que poner `TRUST_PROXY="true"`, o todas las
peticiones parecerán venir de la misma IP (la del balanceador) y el límite se
agotará para todos a la vez. Pero **sólo** si hay un proxy de confianza
delante: si la API se expone directo, cualquiera falsifica `x-forwarded-for` y
se saltea el límite rotando el valor.

---

## 9 · Los pasos, en orden

```bash
# 1 · Backend
cd apps/api
cp ../../.env.example .env          # y completá los valores reales
npm ci
npx prisma generate                 # ⚠️ NUNCA `migrate` ni `db push`
npm run build
npm run start:prod                  # arranca desde dist/main

# 2 · Comprobar que arrancó bien
curl -s localhost:3000/health | jq

# 3 · Frontend
cd ../web
cp .env.example .env                # poné VITE_API_URL
npm ci
npm run build                       # el valor queda DENTRO de dist/
# servir apps/web/dist con nginx, Caddy, o el estático de tu plataforma
```

⚠️ `prisma migrate` y `db push` están **prohibidos** en este proyecto: el
schema no declara las tablas de la app móvil y las borraría. El repositorio
tiene un guard que los bloquea (`npm run verificar:bloqueo-prisma`).

---

## 10 · Lo que este documento NO cubre

Cosas medidas y **no** resueltas en esta tanda, para que no se descubran de
sorpresa:

- **RLS deshabilitada en 77 tablas.** El aislamiento entre clientes lo hace el
  código (`tenantWhere`, `assertTenantOwnership`), no la base. No se encontró
  ningún cliente `supabase-js` ni clave anónima en el frontend, así que el
  riesgo depende de si la API REST de Supabase (PostgREST) está expuesta con la
  clave anónima publicada en algún lado. Habilitar RLS sin políticas bloquea
  todo acceso: es una tanda propia.
- **22 vulnerabilidades** en el árbol de dependencias (eran 49). Las que
  quedan vienen de paquetes que el código **sí** usa: `multer`, `puppeteer`,
  `prisma`, `exceljs`. Se resuelven actualizando, y eso puede romper cosas.
- **El límite de peticiones es por proceso** (§8).
- **`/uploads` se sirve sin autenticación.** Los nombres de archivo ahora son
  criptográficamente aleatorios —eran predecibles—, pero quien tenga la URL ve
  la foto. Si eso no alcanza, hay que servirlas por una ruta con guard.
