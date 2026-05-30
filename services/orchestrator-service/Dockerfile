FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY shared/ ./shared/
COPY services/ ./services/
RUN npm config set registry https://registry.npmmirror.com && npm install --workspaces
RUN npm run build --workspace=@netbench/logger
RUN npm run build --workspace=@netbench/types
RUN npm run build --workspace=@netbench/messaging
RUN npm run build --workspace=@netbench/database
RUN npm run build --workspace=@netbench/orchestrator-service
RUN cd /app/node_modules/@netbench && for d in */; do if [ -L "${d%/}" ]; then target=$(readlink -f "${d%/}"); rm "${d%/}"; cp -r "$target" "${d%/}"; fi; done
RUN for svc in /app/services/*/; do if [ -d "$svc/node_modules" ]; then cp -rn $svc/node_modules/* /app/node_modules/ 2>/dev/null || true; fi; done

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/orchestrator-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/orchestrator-service/package.json ./
EXPOSE 3008
CMD ["node", "dist/index.js"]
