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
    const requestBody = {
        model: this.model,
        messages,
      }
    const response = await llm.chat.completions.create(requestBody);
    await this.db.createLog({
      sessionId: this.sessionId,
      chatId: response.id,
      baseUrl: llm.baseURL,
      requestModel: this.model,
      requestMessages: JSON.stringify(messages),
      userQuestion: messages[messages.length - 1].content,
      requestRaw: JSON.stringify(requestBody),
      responseModel: response.model,
      assistantReply: response.choices[0].message.content || "",
      responseRaw: JSON.stringify(response),
    });
    return response;
  }

  async convo(messages: any[]) {
    console.log(chalk.bgYellow(chalk.black(JSON.stringify(messages, null, 2))));
    return this.chatCompletion(messages);
  }

  async updateLongTermMemory(assistantMessage: string) {
    const shortTermMemoriesUpdate = `${this.shortTermMemories
        .map(({ content, role }) => `${role}: ${content}`)
        .join("\n")}\nAssistant: ${assistantMessage}`;
    const prompt = `Act as a professional notetaker, you will be given an existing long term memory of a character and recent conversation, please update the memory of the character. Please do not add additional contexts if it doesn't exist, only update the memory.

### Old Memory        
${this.longTermMemory}

### Recent Conversation
${shortTermMemoriesUpdate}`;

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
