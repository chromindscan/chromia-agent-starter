# Chromia Agent Starter

This repository demonstrates using Chromia to store AI Agent short-term and long-term memories.

![](ui.jpeg)

![](demo.png)

## How to Run

### Prerequisites
- Install [Bun](https://bun.sh/)
- Install [Chromia CLI](https://docs.chromia.com/intro/installation/cli-installation)

### Steps
1. Install dependencies:
   ```sh
   bun install
   ```
   Update `XAI_API_KEY` in `.env`.

2. Build the Chromia node:
   ```sh
   chr build
   ```

3. Start the Chromia node:
   ```sh
   chr node start
   ```
   To start with a wiped database:
   ```sh
   chr node start --wipe
   ```

4. In another terminal, start the UI at localhost:1234
    ```sh
    bun run ui
    ```

5. In another terminal, run the AI Agent:
   ```sh
   bun run dev
   ```

