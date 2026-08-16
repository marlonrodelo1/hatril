# Imagen de producción para Dokploy.
#
# Tres etapas: dependencias, build y ejecución. Solo la última llega al VPS, y
# lleva `.next/standalone` en lugar del árbol entero de `node_modules`.
#
# LAS VARIABLES NEXT_PUBLIC_ SE HORNEAN EN EL BUILD
# -------------------------------------------------
# No se leen en ejecución: Next las sustituye por su valor literal dentro del
# JavaScript que se manda al navegador. Por eso van como `ARG` en la etapa de
# build y no basta con ponerlas en el entorno del contenedor.
#
# Si alguna falta al construir, la aplicación compila igual y falla en el
# navegador con «supabaseUrl is required», que no dice nada de dónde está el
# problema. De ahí la comprobación explícita antes de `npm run build`.
#
# Y NINGÚN `ARG` LLEVA VALOR POR DEFECTO
# --------------------------------------
# Los secretos salen del panel de Dokploy y de ningún otro sitio. Un default
# aquí acabaría commiteado, que es exactamente cómo la clave de Dokploy de
# Pidoo terminó en texto plano dentro de su CLAUDE.md.

# ---------- Dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Solo los manifiestos: así esta capa se reutiliza mientras no cambien las
# dependencias, y un cambio de código no reinstala nada.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_TELEMETRY_DISABLED=1

# Fallar aquí, con un mensaje claro, en lugar de desplegar una aplicación que
# revienta al abrirla.
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ]; then \
      echo ""; \
      echo "  Faltan variables de build."; \
      echo "  En Dokploy -> Environment, define al menos:"; \
      echo "    NEXT_PUBLIC_SUPABASE_URL"; \
      echo "    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"; \
      echo "    NEXT_PUBLIC_SITE_URL"; \
      echo ""; \
      exit 1; \
    fi

RUN npm run build

# ---------- Ejecución ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios. Si algún día alguien encuentra una forma de ejecutar
# código en el contenedor, que no lo haga como root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# `server.js` lo genera la salida standalone. No es `npm start`: eso llamaría a
# `next start`, que necesita el `next` completo y no está en esta imagen.
CMD ["node", "server.js"]
