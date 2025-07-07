FROM node:20-slim

# Install curl and unzip
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Verify bun installation
RUN /root/.bun/bin/bun --version

WORKDIR /app

# Copy package files and source
COPY package.json bun.lockb* ./
COPY . .

# Install dependencies and build using full path to bun
RUN /root/.bun/bin/bun install
RUN if [ -f "tsconfig.json" ]; then /root/.bun/bin/bun run build; fi

EXPOSE 8080

CMD ["/root/.bun/bin/bun", "run", "start"]