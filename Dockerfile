# Build: bake the homepage, search/share tags and sitemap into the HTML
FROM node:22-alpine AS build
WORKDIR /site
COPY . .
RUN node tools/prerender.mjs /site && rm -rf tools

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# The whole site is static; .dockerignore keeps build files out of the image
COPY --from=build /site /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/nginx.conf

# Stamp every local script/stylesheet URL with a per-build version so caches
# (browsers and Cloudflare) never pair new pages with old scripts after a deploy
RUN V=$(date +%s) && find /usr/share/nginx/html -name '*.html' -exec \
    sed -i -E "s#(src|href)=\"(/[^\"?]+\.(js|css))\"#\1=\"\2?v=$V\"#g" {} +

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
