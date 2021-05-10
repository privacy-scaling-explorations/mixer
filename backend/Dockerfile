ARG NODE_VERSION=16-buster

#FROM node:${NODE_VERSION} AS mixer-backend

#COPY --from=mixer-base /mixer /mixer

FROM mixer-base AS mixer-backend

WORKDIR /mixer/backend

RUN rm -rf /mixer/frontend

CMD ["node", "build/index.js"]
