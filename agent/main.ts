import dotenv from "dotenv";
dotenv.config();

import {
  blockchainIid,
  ChromiaDB,
  clientUrl,
  signatureProvider,
} from "./services/chromia";
import { MemoryTool } from "./tools/memory";
import fs from "fs";
import readline from "readline";
import chalk from "chalk";

async function main() {
  const db = new ChromiaDB({
    clientUrl,
    signatureProvider,
    blockchainIid,
  });
  await db.init();

  // 1. Create Agent
  const tempRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log(chalk.yellow("Creating agent..."));
    const question = (query: string): Promise<string> =>
      new Promise((resolve) => tempRl.question(query, resolve));
    const agentName = await question(chalk.yellow("Enter agent name: "));
    const goal = await question(chalk.yellow("Enter agent goal: "));
    await db.createAgent(agentName, goal);
    tempRl.close();
  } catch {
    console.log(chalk.red("Agent already exists or creation failed."));
    tempRl.close();
  }

  // 2. Generate Session ID
  let sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    sessionId = await db.generateSessionId();
    fs.appendFileSync(".env", `\nSESSION_ID=${sessionId}`);
  }
  console.log(chalk.cyan(`Session ID: ${sessionId}`));
  console.log(chalk.cyan("http://localhost:1234?sessionId=" + sessionId));

  const memoryTool = new MemoryTool(db, sessionId);
  await memoryTool.init();

  // 3. Start Conversation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("You: "),
  });

  rl.prompt();

  for await (const line of rl) {
    // 4. Handle User Input
    const userInput = line.trim();

    // 5. Handle Commands (if starts with !)
    if (userInput.startsWith("!")) {
      // Handle commands
      const command = userInput.slice(1).trim().toLowerCase();
      if (command === "exit" || command === "quit") {
        console.log(chalk.yellow("Conversation ended."));
        break;
      } else if (command === "history") {
        const longTermMemory = await db.getLongTermMemory(sessionId);
        const shortTermMemories = (await db.getLatestShortTermMemories(
          sessionId
        )) as any[];

        console.log(chalk.yellow("\nLong Term Memory:"));
        console.log(chalk.white(longTermMemory));

        console.log(chalk.yellow("\nShort Term Memories:"));
        shortTermMemories.reverse().forEach(({ role, content }) => {
          const roleLabel =
            role === "user" ? chalk.green("You") : chalk.cyan("Assistant");
          console.log(`${roleLabel}: ${content}`);
        });
      } else {
        console.log(chalk.red(`Unknown command: ${command}`));
      }
      rl.prompt();
      continue;
    }

    const assistantContextMessages = [
      {
        role: "system",
        content: `You are a helpful assistant. You are given a conversation, please keep it as casual as possible. You will be given a goal and long term memory, please use them to help you answer the user's question.
        ${memoryTool.agentName ? `\n\nAssistant Name: ${memoryTool.agentName}` : ""}
        ${memoryTool.agentGoal ? `\n\nAgent Goal: ${memoryTool.agentGoal}` : ""}
        ${
          memoryTool.longTermMemory
            ? `\n\nLong Term Memory: ${memoryTool.longTermMemory}`
            : ""
        }`,
      },
      ...memoryTool.shortTermMemories
        .map(({ content, role }) => ({ role, content }))
        .reverse(),
      {
        role: "user",
        content: userInput,
      },
    ];

    const result = await memoryTool.convo(assistantContextMessages);

    const assistantMessage = result.choices[0].message.content!;
    console.log(chalk.cyan(`Assistant: ${assistantMessage}`));

    await memoryTool.addShortTermMemory({
      session_id: sessionId,
      role: "user",
      content: userInput,
    });
    await memoryTool.addShortTermMemory({
      session_id: sessionId,
      role: "assistant",
      content: assistantMessage!,
    });
    await memoryTool.updateLongTermMemory(assistantMessage);

    rl.prompt();
  }

  rl.close();
}

main();
