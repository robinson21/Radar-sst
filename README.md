# Radar SST MVP

MVP de una plataforma para monitoreo normativo SST en Chile, preparado para:

- desarrollo local con archivo `data/state.json`
- despliegue web en `Vercel`
- persistencia gratuita en `Neon Postgres`
- escaneo automático diario vía cron

## Stack recomendado gratis

- `GitHub` para código
- `Vercel Hobby` para frontend + API serverless
- `Neon Free` para base de datos

Fuentes monitoreadas hoy:

- `BCN`
- `SUSESO`
- `DT`
- `MINSAL`
- `SEC`
- `Diario Oficial`

## Variables de entorno

Revisa [.env.example](/Users/robinsonarmijovargas/Downloads/asistente-st-chile-ia/.env.example:1)

Claves:

- `PORT`: solo local
- `SCAN_INTERVAL_MINUTES`: frecuencia local del scheduler
- `REMOTE_FETCH_ENABLED`: habilita fetch remoto
- `DATABASE_URL`: si existe, usa Neon/Postgres en vez de archivos locales

## Ejecutar local

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/sources`
- `POST /api/scan`
- `POST /api/company-profile`
- `POST /api/watch-requests`
- `PATCH /api/watch-requests/:id`
- `PATCH /api/obligations/:id`
- `POST /api/reset`
- `GET /api/cron/scan` en despliegue Vercel

## Persistencia

Local:
- estado en `data/state.json`
- snapshots en `data/snapshots/`

Web:
- si configuras `DATABASE_URL`, estado y snapshots se guardan en Postgres

## Despliegue recomendado

### 1. GitHub

```bash
git init
git add .
git commit -m "Initial Radar SST MVP"
```

Luego sube el repo a GitHub.

### 2. Neon

1. Crea un proyecto gratis en `https://neon.com`
2. Copia el `DATABASE_URL`

### 3. Vercel

1. Importa el repo desde GitHub
2. Configura variables:
   - `DATABASE_URL`
   - `REMOTE_FETCH_ENABLED=true`
3. Despliega

El archivo [vercel.json](/Users/robinsonarmijovargas/Downloads/asistente-st-chile-ia/vercel.json:1) deja un cron diario a las `09:00 UTC`.

## Estado actual

- API compartida para local y serverless
- persistencia opcional en Neon
- cron diario listo para Vercel
- fallback local cuando no existe DB

## Siguiente capa recomendada

1. Afinar parser por fuente para bajar ruido
2. Agregar clasificación jurídica más precisa
3. Separar tablas por hallazgo, fuente y empresa
4. Generar documentos reales en `DOCX/PDF`
