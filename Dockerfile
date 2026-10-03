# 团队协同服务器（云端部署）。构建：docker build -t team-ops .
# 运行：docker run -d -p 8787:8787 -v team-ops-data:/data -e ANTHROPIC_API_KEY=... --restart unless-stopped team-ops
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY engine.js sync.js native.js app.js style.css shell.html build.js ./
COPY img ./img
COPY fonts ./fonts
COPY server ./server
RUN node build.js
ENV PORT=8787 HOST=0.0.0.0 DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["node", "server/server.js"]
