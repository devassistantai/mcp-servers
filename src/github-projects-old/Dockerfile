FROM node:20-alpine AS builder

# Must be entire project because `prepare` script is run during `npm install` and requires all files.
COPY src/github-projects /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

RUN npm install

FROM node:20-alpine AS release

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

WORKDIR /app

RUN npm ci --ignore-scripts --omit-dev

ENTRYPOINT ["node", "dist/index.js"] 