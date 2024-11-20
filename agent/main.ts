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
  try {
    await db.createAgent("test");
  } catch {
    console.log(chalk.red("Agent already exists or creation failed."));
  }

  // 2. Generate Session ID
  let sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    sessionId = await db.generateSessionId();
    fs.appendFileSync(".env", `\nSESSION_ID=${sessionId}`);
  }
  console.log(chalk.cyan(`Session ID: ${sessionId}`));

  const memoryTool = new MemoryTool(db, sessionId);

  // 3. Start Conversation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("You: "),
  });

  rl.prompt();

  for await (const line of rl) {
    const shortTermMemories = (await db.getLatestShortTermMemories(
      sessionId
    )) as any[];
    const longTermMemory = await db.getLongTermMemory(sessionId);

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
        const shortTermMemories = await db.getLatestShortTermMemories(
          sessionId
        ) as any[];

        console.log(chalk.yellow("\nLong Term Memory:"));
        console.log(chalk.white(longTermMemory));

        console.log(chalk.yellow("\nShort Term Memories:"));
        shortTermMemories!.reverse().forEach(({ role, content }) => {
          const roleLabel =
            role === "user"
              ? chalk.green("You")
              : chalk.blue("Assistant");
          console.log(`${roleLabel}: ${content}`);
        })
      } else {
        console.log(chalk.red(`Unknown command: ${command}`));
      }
      rl.prompt();
      continue;
    }

    const assistantContextMessages = [
      {
        role: "system",
        content: `You are a helpful assistant. You are given a conversation, please keep it as casual as possible.${longTermMemory ? `\n\nLong Term Memory: ${longTermMemory}` : ""}`,
      },
      ...shortTermMemories!
        .map(({ content, role }) => ({ role, content }))
        .reverse(),
      {
        role: "user",
        content: userInput,
      },
    ];

    const result = await memoryTool.convo(
      assistantContextMessages
    );

    const assistantMessage = result.choices[0].message.content;
    console.log(chalk.blue(`Assistant: ${assistantMessage}`));

    await db.addShortTermMemory({
      session_id: sessionId,
      role: "user",
      content: userInput,
    });
    await db.addShortTermMemory({
      session_id: sessionId,
      role: "assistant",
      content: assistantMessage!,
    });

    const longTermMemoryUpdate = `${shortTermMemories!
      .map(({ content, role }) => `${role}: ${content}`)
      .join("\n")}\nAssistant: ${assistantMessage}`;
    await memoryTool.updateLongTermMemory(longTermMemoryUpdate);

    rl.prompt();
  }

  rl.close();
}

main();