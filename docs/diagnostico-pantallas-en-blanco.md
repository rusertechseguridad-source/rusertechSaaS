# Diagnóstico · pantallas en blanco

Medido el 29/09/2026 sobre `25cd650`, en Chromium, contra el bundle real
(`vite preview`), a 1440 × 900. **Sin cambios de código.**

## Cómo se midió

Un recorrido de Playwright por las **23 rutas privadas** de `App.tsx`, con:

- **dos perfiles con los permisos del seed** (`prisma/seed.ts`): dueño de cuenta
  y operador. Después, un tercero —`manager`— para los casos que el recorrido
  señaló;
- **dos backends de mentira**: uno que responde `[]` a todo, y otro que responde
  `500` a todo.

Por pantalla se anotó el texto visible dentro de `<main>`, los controles
visibles y los errores de JavaScript. Donde el texto era casi nulo, se sacó una
captura. Las pestañas de Configuración, que no son rutas, se recorrieron aparte
con un `manager`.

Y se descartó una causa para todas antes de empezar: **ningún enlace interno
apunta a una ruta que no exista** (barrido de `to=` y `navigate(` contra las 28
rutas de `App.tsx`).

⚠️ **No tuve la lista vieja** con sus archivos y líneas, así que no puedo decir
cuáles de estas coinciden con aquellas. Lo que sí puedo decir: son cinco, y las
cinco tienen **la misma causa**.

## Las cinco

| # | Pantalla | Quién la ve en blanco | Cómo llega | Archivo |
|---|---|---|---|---|
| 1 | Protocolos operativos (`/admin/protocols`) | `manager` · operador | **manager: desde el menú, con el enlace habilitado** · operador: sólo por URL | `pages/admin/protocols/ListPage.tsx:130` |
| 2 | Llaves de seguridad (`/admin/security-keys`) | `manager` · operador | ídem | `pages/admin/security-keys/ListPage.tsx:86` |
| 3 | Configuración › SLAs NDR | `manager` | desde la pestaña, que ve habilitada | `pages/settings/ndr/NdrPanel.tsx:95` |
| 4 | Configuración › Parámetros Operativos | `manager` | ídem | `pages/settings/operativos/OperativosPanel.tsx:99` |
| 5 | Simulador (`/simulator`) | operador | sólo por URL: el menú lo muestra apagado | `pages/dev/SimulatorPage.tsx:17` |

Medido:

- 1 y 2: **0 caracteres y 0 controles** en `<main>`. Ni siquiera el título.
- 3 y 4: se ve la barra de pestañas y, a la derecha, **una caja vacía**.
- 5: título y descripción («Simulador Dev · Generador de eventos GPS…») y,
  debajo, nada: 78 caracteres, 0 controles.

## Por qué: la misma causa en las cinco

Las cinco envuelven **el contenido entero** en `<RequirePermission>` **sin
`fallback`**:

```tsx
<RequirePermission permission="manage_settings">   // 1, 2, 3, 4
<RequirePermission permission="view_simulator">    // 5
```

Sin `fallback`, `RequirePermission` devuelve `null`. Su propio comentario lo
advierte —«para una pantalla entera hay que pasar un mensaje»— y cuatro
pantallas **sí** lo hacen bien, con `fallback={<SinPermiso …/>}`: Motor,
Reportes, Monitor AVL y Monitoreo. Medido: el operador en `/motor` ve «No
tenés permiso para ver esta sección · Requiere el permiso view_settings».

Ninguna de las cinco falla por **ruta faltante, consulta que falla, ni
componente inexistente**. Es **el permiso, que las bloquea sin decirlo**.

### Y en 1 y 2, además, el menú y la pantalla piden permisos distintos

El ítem del menú pide `view_settings` (`AppLayout.tsx:185-186`); la pantalla
pide `manage_settings`. El `manager` del seed tiene el primero y no el segundo:
el menú le ofrece un enlace **habilitado** que lo lleva a una pantalla vacía. Es
la peor combinación: la navegación dice que puede entrar, y la pantalla no le
dice por qué no hay nada.

## Qué se arregla con un cambio chico, y qué necesita su propia tanda

**Las cinco se arreglan con un cambio chico y del mismo tipo**: pasarle a cada
`RequirePermission` el `fallback={<SinPermiso permission="…" />}` que ya usan las
pantallas que funcionan. Una línea por pantalla, y una prueba de Playwright por
perfil que confirme que se lee el motivo.

**Lo que no es chico, y conviene decidir antes**: en 1 y 2, ¿quién tiene que
poder VER los protocolos y las llaves?

- Si el `manager` tiene que verlas, la pantalla debería pedir `view_settings`
  para leer y reservar `manage_settings` para los botones de escribir (que
  entonces se deshabilitan con motivo, no se esconden).
- Si no tiene que verlas, el menú debería pedir `manage_settings` para que el
  ítem aparezca apagado con el motivo.

Es una decisión de producto, no de código.

## Encontrado de paso, fuera de este diagnóstico

1. **El límite de errores se lleva el menú, y dice lo contrario.**
   `App.tsx:69` envuelve TODAS las rutas con `ErrorBoundary`. Cuando una
   pantalla falla al dibujarse, desaparece la aplicación entera —la barra
   incluida— y el mensaje dice «El resto de la aplicación sigue funcionando».
   Se vio forzando una respuesta con forma incorrecta en `/avl/monitor`
   (captura: sin barra, sin `<main>`). Es de la clase «el sistema dice lo
   contrario de lo que pasó».
2. **`/admin` se dibuja para un operador.** Con un operador, por URL, se ve el
   «Super Admin Panel» con 19 controles. El backend lo bloquea
   (`checkSuperAdmin`), pero la pantalla no dice que no corresponde.
3. **Pantallas que ante un 500 muestran el error sin salida**: `/avl` («Failed
   to fetch AVL users»), `/carriers` y `/drivers` («Error loading …»),
   `/trips/:id` («Viaje no encontrado» ante un 500, que no es lo mismo que no
   existir). No están en blanco, pero no ofrecen reintentar, y la última dice
   algo falso: el viaje puede existir.

## Lo que esta medición NO cubre

- **Datos reales.** El backend fue de mentira. Un `[]` donde la API devuelve un
  objeto hizo caer `/avl/monitor` (`Cannot read properties of undefined
  (reading 'length')`), pero la API real devuelve `{ proveedores, … }`: eso fue
  un artefacto de la medición y **no** cuenta como pantalla en blanco.
- **Roles personalizados.** Se midieron los del seed. Un rol creado desde la
  pantalla de roles con otra combinación de permisos puede caer en otra.
- **La ventana chica.** Todo se midió a 1440 px.
