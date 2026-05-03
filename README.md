# 🛰️ Rusertech — Plataforma SaaS de Seguimiento Satelital

Rusertech es una plataforma empresarial multi-tenant avanzada para el seguimiento satelital vehicular, gestión de flotas y monitoreo de viajes en tiempo real.

## 🚀 Estado del Proyecto: BLOQUE 0 Finalizado

Actualmente, el proyecto ha completado las fases de infraestructura base y sitio público.

### ✅ Bloques Completados
- **BLOQUE -1 — Sitio Público:** Landing page funcional con diseño premium, responsiva y orientada a conversión B2B.
- **BLOQUE 0 — Infraestructura:** 
  - Monorepo configurado con NestJS (Backend) y React+Vite (Frontend).
  - Base de datos PostgreSQL (Supabase) con PostGIS inicializada.
  - Esquema de datos con 16 modelos de negocio implementados en Prisma.
  - Estrategia de particionamiento mensual para telemetría activa vía `pg_cron`.
  - Integración con Redis (Upstash) para caché y colas de procesos.

## 🛠️ Stack Tecnológico

- **Backend:** NestJS 10, Prisma 6, JWT/Passport, Socket.io, BullMQ.
- **Frontend:** React 18, TailwindCSS, Zustand, TanStack Query, MapLibre GL JS.
- **Base de Datos:** PostgreSQL (Supabase) + PostGIS, Redis (Upstash).
- **Infraestructura:** Docker, Nginx (planeado).

## 📂 Estructura del Repositorio

- `apps/api`: Backend NestJS (API REST, WebSockets, Engine).
- `apps/web`: Frontend React (Sitio público y Dashboard SaaS).
- `packages/shared`: Tipos y lógica compartida (Prisma Schema).
- `infra/`: Scripts de migración SQL y configuración de servidores.

## 🏁 Cómo Iniciar

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/rusertechseguridad-source/rusertechSaaS.git
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copiar `.env.example` a `.env` en `apps/api` y configurar las credenciales de Supabase y Redis.

4. **Levantar el entorno de desarrollo:**
   - Backend: `cd apps/api && npm run start:dev`
   - Frontend: `cd apps/web && npm run dev`

---
**Desarrollado por Rusertech — Seguridad & Logística**
