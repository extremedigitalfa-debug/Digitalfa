# Multi-stage build: build the React client, then run the API which also
# serves the built client (single container). Works on Fly.io, Railway,
# Render (Docker), or any container host. Provide DATABASE_URL at runtime.

FROM node:22-slim AS build
WORKDIR /app
# client
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build
# server deps (postinstall runs `prisma generate`)
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma
RUN cd server && npm install
COPY server ./server

FROM node:22-slim
WORKDIR /app
# Prisma needs openssl at runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server ./server
WORKDIR /app/server
EXPOSE 4000
# migrate then start; the server serves ../client/dist
CMD ["npm", "run", "start:prod"]
