# ---- NexVOffice: Single-container build ----
# Colyseus (Express) serves both the API/WebSocket and the static client files.

FROM node:20-alpine AS build

WORKDIR /app

# Root dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Shared types
COPY types/ types/
RUN cd types && yarn install --frozen-lockfile

# Compile server
COPY server/ server/
RUN cd server && npx tsc --project tsconfig.server.json

# Build client
COPY client/ client/
RUN cd client && yarn install --frozen-lockfile && yarn build

# ---- Production ----
FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY types/ types/
RUN cd types && yarn install --frozen-lockfile --production 2>/dev/null || true

# Compiled server
COPY --from=build /app/server/lib server/lib

# Database migrations
COPY --from=build /app/server/db/migrations server/db/migrations

# Built client static files
COPY --from=build /app/client/dist client/dist

EXPOSE 2567

CMD ["node", "server/lib/server/index.js"]
