ARG NODE_VERSION=16-buster

FROM node:${NODE_VERSION} AS mixer-build
WORKDIR /mixer

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

COPY package.json lerna.json tsconfig.json /mixer/

RUN npm install --quiet && \
    npm cache clean --force

COPY scripts /mixer/scripts
COPY semaphore /mixer/semaphore
COPY libsemaphore /mixer/libsemaphore
COPY surrogeth /mixer/surrogeth

RUN cd /mixer/ && \
    ./scripts/downloadSnarks.sh --only-verifier

RUN mkdir /mixer/contracts && \
    mkdir /mixer/config && \
    mkdir /mixer/utils && \
    mkdir /mixer/frontend

COPY config/package*.json /mixer/config/
COPY contracts/package*.json /mixer/contracts/
COPY utils/package*.json /mixer/utils/
COPY frontend/package*.json /mixer/frontend/

RUN cd libsemaphore && \
    npm i
RUN cd surrogeth/client && \
    npm i

RUN npx lerna bootstrap --no-progress \
    --scope '{mixer-utils,mixer-config,mixer-contracts,mixer-frontend}'

COPY contracts /mixer/contracts
COPY config /mixer/config
COPY utils /mixer/utils
COPY frontend /mixer/frontend

RUN rm -rf /mixer/frontend/build /mixer/frontend/dist

RUN npm run build

RUN echo "Building frontend with NODE_ENV=production" && \
    cd frontend && \
    npm run build && \
    npm run webpack-build

FROM node:${NODE_VERSION} AS mixer-base

COPY --from=mixer-build /mixer/contracts /mixer/contracts
COPY --from=mixer-build /mixer/config /mixer/config
COPY --from=mixer-build /mixer/utils /mixer/utils
COPY --from=mixer-build /mixer/frontend /mixer/frontend

COPY --from=mixer-build /mixer/package.json /mixer/package.json
COPY --from=mixer-build /mixer/lerna.json /mixer/lerna.json
COPY --from=mixer-build /mixer/tsconfig.json /mixer/tsconfig.json

RUN rm -rf /mixer/contracts/ts/ \
    /mixer/config/ts/ \
    /mixer/utils/ts/ \
    /mixer/frontend/ts/

WORKDIR /mixer

#RUN cd contracts && npm uninstall --save-dev && \
#   cd ../config && npm uninstall --save-dev && \
#   cd ../utils && npm uninstall --save-dev && \
#   cd ../frontend && npm uninstall --save-dev
