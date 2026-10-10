FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# The whole site is static; .dockerignore keeps build files out of the image
COPY . /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
