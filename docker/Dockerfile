FROM node:18-alpine as build
WORKDIR /app

ENV CI=true

# 复制 package.json 和 pnpm-lock.yaml
COPY app/package.json app/pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

# 复制整个 app 代码目录
COPY app ./

RUN pnpm build

# 运行阶段
FROM nginx:alpine

# 将构建后的 dist 复制到 nginx 静态文件目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制自定义 nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

