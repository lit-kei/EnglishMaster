FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.js ai.js ./
COPY --chown=node:node public ./public
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
