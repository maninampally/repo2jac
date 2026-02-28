FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy all source files
COPY . .

EXPOSE 3000

# Use dev server for hot reload in Docker Compose local development.
# For a production image, replace with: RUN npm run build && CMD ["npm", "start"]
CMD ["npm", "run", "dev"]