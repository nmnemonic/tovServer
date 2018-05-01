FROM node:7

# Create app directory
RUN mkdir -p /usr/src/app/lib
WORKDIR /usr/src/app

# Install app source
COPY . /usr/src/app

# Install app dependencies
RUN npm install

EXPOSE 8080
CMD [ "npm", "start" ]
