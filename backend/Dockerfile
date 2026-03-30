FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .
VOLUME ["/data"]
ENV PORT=3001
ENV DATA_DIR=/data
EXPOSE 3001
CMD ["node", "server.js"]
