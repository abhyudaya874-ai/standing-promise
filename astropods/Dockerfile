FROM node:22-alpine
WORKDIR /app
COPY agent.mjs server.mjs AGENT.md ./
ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
