# DTOs — por qué existen y cuándo se agrega uno

Hasta la Tanda 3 no había **ningún** DTO en el proyecto: los handlers recibían
`@Body() body: any` y el cuerpo entero llegaba a Prisma. Eso permitía seis
asignaciones masivas, y la peor movía un vehículo a otro cliente con sólo poner
`tenant_id` en el JSON.

El `ValidationPipe` global de `main.ts` corre con `whitelist` y
`forbidNonWhitelisted`. **Sólo actúa donde hay una clase**: si el handler declara
`@Body() body: any`, el metatipo es `Object` y el pipe no valida nada. Por eso
agregar un DTO es lo que enciende la validación de esa ruta, y por eso se agregan
de a poco: cada DTO nuevo es una pantalla que puede dejar de funcionar.

## Reglas

1. **Los campos se copian del `schema.prisma`, no de la memoria.** Omitir una
   columna que sí se guardaba hace que deje de guardarse **en silencio**: el
   `whitelist` la descarta sin avisar. Ya pasó tres veces en esta serie que una
   lista escrita de memoria omitió columnas reales.
2. **Nunca se declaran** `id`, `tenant_id`, `created_at` ni `updated_at`. Son la
   identidad y la auditoría de la fila: si no están en el DTO, no se pueden
   escribir desde el cuerpo de la petición. Ése es el punto.
3. **Todo opcional en los `update`.** Las pantallas mandan formularios parciales
   y Prisma ignora las claves ausentes; exigir un campo rompería la edición.
4. **Antes de escribirlo, mirá qué manda la pantalla.** Un DTO correcto que no
   contempla lo que el formulario envía rompe la pantalla con un 400.

## Un detalle del `transform`

Con `transform: true`, el servicio recibe una INSTANCIA del DTO, no el objeto
plano. Y como el target es ES2023, TypeScript define todos los campos declarados
de la clase, así que los que el cliente no mandó llegan con valor `undefined`.

Prisma **ignora** las claves `undefined`, de modo que no cambia lo que se guarda.
Pero si algún día un servicio hace `Object.keys(data)` para decidir algo, va a
ver campos que el cliente nunca envió. La suite `validacion-pantallas.spec.ts` lo
afirma explícitamente para que el día que eso cambie, se note.
