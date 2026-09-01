# frontend/Dockerfile
FROM node:20-alpine
# Set working directory
WORKDIR /app
# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
# Copy the rest of the frontend code
ARG INTERNAL_API_URL
ENV INTERNAL_API_URL=${INTERNAL_API_URL}

ARG NEXT_PUBLIC_WS_BASE_URL=""
ENV NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL}

COPY . .
RUN npm run build
# Expose frontend port
EXPOSE 3000
# Run Next.js
CMD ["npm", "start"]