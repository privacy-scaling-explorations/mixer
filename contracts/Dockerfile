ARG NODE_VERSION=16-buster

FROM node:${NODE_VERSION} AS mixer-testnet

COPY --from=mixer-base /mixer /mixer

WORKDIR /mixer/contracts

#RUN npm run deploy

CMD ["npm", "run", "ganache"]
