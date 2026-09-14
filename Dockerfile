FROM node:20-alpine

WORKDIR /app

# 零运行时依赖，直接拷贝源码
COPY package.json ./
COPY server/ ./server/
COPY public/ ./public/
COPY data/ ./data/

ENV PORT=3100
ENV APP_MODE=mock
EXPOSE 3100

# ZHIHU_ACCESS_SECRET 通过部署平台的环境变量注入，不写进镜像
CMD ["node", "server/index.js"]
