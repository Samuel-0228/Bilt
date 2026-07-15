FROM node:20-alpine

# This is a test Dockerfile to verify that the bilt-plugin-docker plugin works.
# It contains a simulated Stripe API key that should trigger a critical alert.
ENV API_KEY="sk_test_51NzABC1234567890abcdef"

WORKDIR /app
COPY . .
CMD ["node", "index.js"]
