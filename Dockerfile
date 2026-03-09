# -------- Build Stage --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# install all deps (including dev for tsc)
RUN npm ci

COPY . .

# build typescript
RUN npx tsc


# -------- Production Stage --------
FROM node:20-alpine

WORKDIR /app

# create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./

# install only production deps
RUN npm ci --omit=dev

# copy build files from builder
COPY --from=builder /app/dist ./dist

# change ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8790

CMD ["node", "dist/server.js"]