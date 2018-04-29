FROM node:slim

# Create app directory
RUN mkdir -p /usr/src/app/lib
WORKDIR /usr/src/app

# Install app source
COPY . /usr/src/app
COPY data /usr/src/app/data

# Install app dependencies
RUN npm install


EXPOSE 8080
CMD [ "npm", "start" ]
