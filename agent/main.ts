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

async function main() {
  const db = new ChromiaDB({
    clientUrl,
    signatureProvider,
    blockchainIid,
  });
  await db.init();

  try {
    await db.createAgent("test");
  } catch {
    console.log("Agent already exists or creation failed.");
  }

  let sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    sessionId = await db.generateSessionId();
    fs.appendFileSync(".env", `\nSESSION_ID=${sessionId}`);
  }
  console.log(`Session ID: ${sessionId}`);

  const memoryTool = new MemoryTool(db, sessionId);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for await (const line of rl) {
    const longTermMemory = await db.getLongTermMemory(sessionId);
    const shortTermMemories = (await db.getLatestShortTermMemories(
      sessionId
    )) as any[];
    console.log("Long Term Memory:", longTermMemory);
    console.log("Short Term Memories:", shortTermMemories);
    const userInput = line.trim();
    if (
      userInput.toLowerCase() === "exit" ||
      userInput.toLowerCase() === "quit"
    ) {
      console.log("Conversation ended.");
      break;
    }
    const result = await memoryTool.convo(
      "You are a helpful assistant. You are given a conversation, please keep it as casual as possible.",
      [
        ...shortTermMemories!
          .map(({ content, role }) => ({ role, content }))
          .reverse(),
        {
          role: "user",
          content: userInput,
        },
      ]
    );

    const assistantMessage = result.choices[0].message.content;
    console.log(`Assistant: ${assistantMessage}`);
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
    await memoryTool.updateLongTermMemory(
      `${shortTermMemories!
        .map(({ content, role }) => `${role}: ${content}`)
        .join("\n")}\nAssistant: ${assistantMessage}`
    );
    rl.prompt();
  }

  rl.close();
}

main();
