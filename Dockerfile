FROM node:20-slim

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy package files and source
COPY package.json bun.lockb* ./
COPY . .

# Install dependencies and build
RUN bun install
RUN if [ -f "tsconfig.json" ]; then bun run build; fi

EXPOSE 8080

CMD ["bun", "run", "start"]