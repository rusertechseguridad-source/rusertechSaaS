# Rusertech SaaS Architecture

## Overview
Rusertech is built on a modern, scalable architecture designed for multi-tenant SaaS environments focusing on real-time vehicle tracking, IoT integrations, and enterprise fleet management.

## Frontend (apps/web)
The frontend is a Single Page Application (SPA) built with React 18 and Vite.

### Core Technologies
- **React 18 & Vite**: Fast development and optimized production builds.
- **TailwindCSS**: Utility-first CSS framework for rapid, consistent styling.
- **Zustand**: Lightweight global state management (e.g., auth, UI state).
- **TanStack Query**: Data fetching, caching, and state synchronization.
- **MapLibre GL JS**: High-performance, WebGL-based vector maps for real-time tracking.
- **i18next**: Comprehensive internationalization (i18n) supporting English and Spanish.

### Internationalization (i18n) Architecture
The platform is designed to be 100% bilingual.
- **Dictionaries**: Located in `apps/web/src/i18n/locales/`. Structured by component/module domains (e.g., `admin`, `settings`, `nav`).
- **Dynamic Label Translators**: Utility functions (`utils/labels.ts`) intercept raw database enums (like `role.name` or `parameter_key`) and map them dynamically to their localized versions before rendering.
- **Component Integration**: All React components use the `useTranslation()` hook. Hardcoded strings have been completely removed across the Map view, Admin Panel, Settings, and IoT Management panels.

## Backend (apps/api)
- **NestJS**: Modular Node.js framework handling business logic and REST API endpoints.
- **Prisma**: Type-safe ORM connecting to a PostgreSQL (Supabase) database.
- **PostGIS**: Spatial database extension for Geofencing and coordinate routing.
- **Redis & BullMQ**: Message queuing and caching for high-frequency IoT data ingestion and background task processing.
- **Socket.io**: Real-time bidirectional communication for live map updates and alerts.

## Deployment & Infrastructure
- The platform uses **Docker** for containerization to ensure parity between development and production environments.
- **Nginx** acts as a reverse proxy for API load balancing and static file serving.
- Multi-tenancy is strictly enforced via PostgreSQL row-level security concepts mapped through Prisma middleware and JWT claims.
