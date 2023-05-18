# Stage 1: Build the React app
FROM node:14

RUN apt-mark hold git
RUN apt-mark hold git-man

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire application
COPY . .

# Build the React app
RUN npm run build


# Stage 2: Serve the built React app using Nginx
FROM nginx:1.21

# Copy the built app from the previous stage
COPY --from=build /app/build /usr/share/nginx/html

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
