FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && curl -fsSL https://github.com/bytecodealliance/wasmtime/releases/download/v29.0.0/wasmtime-v29.0.0-x86_64-linux.tar.xz \
    | tar -xJ --strip-components=1 -C /usr/local/bin wasmtime-v29.0.0-x86_64-linux/wasmtime \
  && apt-get purge -y --auto-remove curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/webassembly/wasi-sdk:wasi-sdk-24 /opt/wasi-sdk /opt/wasi-sdk
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server

USER node
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/index.js"]