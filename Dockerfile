FROM --platform=linux/amd64 ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# Set working directory
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg2 \
    ca-certificates \
    unzip

RUN curl -fsSL https://apt.chromia.com/chromia.gpg -o /usr/share/keyrings/chromia.gpg

RUN echo "deb [signed-by=/usr/share/keyrings/chromia.gpg] https://apt.chromia.com stable main" \
    > /etc/apt/sources.list.d/chromia.list

# Install Chromia CLI
RUN apt-get update && apt-get install -y chr
RUN apt-get install pmc

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add these lines to ensure bun is in PATH
ENV BUN_INSTALL="/root/.bun"
ENV PATH="/root/.bun/bin:$PATH"

RUN chr --version

RUN rm -rf /var/lib/apt/lists/*
COPY . .
RUN ["bun", "install"]
RUN ["bash", "./script/create_wallet.sh"]
RUN ["bun", "./script/check_balance.sh"]