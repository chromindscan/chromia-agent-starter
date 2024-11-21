import chalk from "chalk";
import { ChromiaDB, ShortTermMemory } from "../services/chromia";
import { llm } from "../services/openai";

export class MemoryTool {
  model: string = "grok-beta";
  shortTermMemories: { role: string; content: string }[] = [];
  longTermMemory: string = "";

  constructor(private db: ChromiaDB, private sessionId: string) {}

  async init() {
    this.shortTermMemories = (await this.db.getLatestShortTermMemories(
      this.sessionId
    )) as any[];
    this.longTermMemory = (await this.db.getLongTermMemory(
      this.sessionId
    )) as string;
  }

  async addShortTermMemory(memory: ShortTermMemory) {
    await this.db.addShortTermMemory(memory);
    this.shortTermMemories = [
      ...this.shortTermMemories,
      {
        role: memory.role,
        content: memory.content,
      },
    ].slice(-10);
  }

  async chatCompletion(messages: any[]) {
    const response = await llm.chat.completions.create({
      model: this.model,
      messages,
    });
    return response;
  }

  async convo(messages: any[]) {
    console.log(chalk.bgYellow(chalk.black(JSON.stringify(messages, null, 2))));
    return this.chatCompletion(messages);
  }

  async updateLongTermMemory(content: string) {
    const currentLongTermMemory = await this.db.getLongTermMemory(
      this.sessionId
    );
    const prompt = `Act as a professional notetaker, you will be given an existing long term memory of a character and recent conversation, please update the memory of the character. Please do not add additional contexts if it doesn't exist, only update the memory.

### Old Memory        
${currentLongTermMemory}

### Recent Conversation
${content}`;

    const response = await this.chatCompletion([
      { role: "system", content: prompt },
    ]);
    const newLongTermMemory = response.choices[0].message.content;
    await this.db.createOrEditLongTermMemory(
      this.sessionId,
      newLongTermMemory!
    );
    this.longTermMemory = newLongTermMemory!;
  }
}
