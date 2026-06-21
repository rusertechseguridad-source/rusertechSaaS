# 🛰️ Rusertech — Plataforma SaaS de Seguimiento Satelital

Rusertech es una plataforma empresarial multi-tenant avanzada para el seguimiento satelital vehicular, gestión de flotas y monitoreo de viajes en tiempo real.

## 🚀 Estado del Proyecto: MVP Funcional

Actualmente, el proyecto ha completado las fases de infraestructura base, sitio público y módulos principales del SaaS.

### ✅ Funcionalidades Completadas
- **Sitio Público:** Landing page funcional con diseño premium B2B.
- **Infraestructura Core:** Backend NestJS, Frontend React+Vite, Base de datos PostgreSQL (Supabase) + Prisma.
- **Mapa Global:** Mapa en tiempo real (MapLibre GL JS) con seguimiento de viajes, vehículos y eventos.
- **Módulos Administrativos:** Gestión de Alertas, Viajes, Vehículos, Dispositivos, Locaciones, Sensores, etc.
- **Internacionalización (i18n):** Plataforma 100% bilingüe (Español / Inglés) con cambio en tiempo real.
- **Seguridad y Accesos (RBAC + Entity-Based):**
  - Roles de usuario (Owner, Manager, Operator, Viewer).
  - Control de accesos granular por entidades: Los usuarios *Viewers* pueden ser restringidos a visualizar únicamente patentes (vehículos) y centros logísticos específicos. El backend asegura y filtra nativamente los registros a través de JWT y Prisma.

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
