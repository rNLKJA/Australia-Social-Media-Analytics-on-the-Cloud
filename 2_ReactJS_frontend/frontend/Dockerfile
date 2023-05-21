# Stage 1: Build react application
FROM node:14 as builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy other source code to work directory
COPY . ./

# Build the application
RUN npm run build

# Stage 2: Serve app with Nginx server

FROM nginx:alpine

# Copy build output to replace the default nginx contents.
COPY --from=builder /app/build /usr/share/nginx/html

# Copy the nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf