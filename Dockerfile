FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma

FROM base AS build
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS production-dependencies
RUN npm ci --omit=dev && npx prisma generate

FROM base
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
