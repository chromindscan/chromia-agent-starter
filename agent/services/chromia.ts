import {
  createClient,
  IClient,
  SignatureProvider,
  newSignatureProvider,
} from "postchain-client";
import { v4 as uuid } from "uuid";

export const clientUrl = "http://localhost:7740";
export const blockchainIid = 0;
export const signatureProvider = newSignatureProvider({
  privKey: "01010101010101010101010101010101010101010101010101010101010101012",
});

interface ChromiaDBConfig {
  clientUrl: string;
  blockchainIid?: number;
  blockchainRid?: string;
  signatureProvider: SignatureProvider;
}

export interface ShortTermMemory {
  session_id: string;
  role: string;
  content: string;
}

export interface Log {
  sessionId: string;
  chatId: string;
  baseUrl: string;
  requestModel: string;
  requestMessages: any;
  userQuestion: string;
  requestRaw: any;
  responseModel: string;
  assistantReply: string;
  responseRaw: any;
}

export class ChromiaDB {
  clientUrl: string | string[];
  blockchainIid?: number;
  blockchainRid?: string;
  client: IClient;
  signatureProvider: SignatureProvider;

  constructor({
    clientUrl,
    blockchainRid,
    blockchainIid,
    signatureProvider,
  }: ChromiaDBConfig) {
    this.clientUrl = clientUrl;
    this.blockchainRid = blockchainRid;
    this.blockchainIid = blockchainIid;
    this.signatureProvider = signatureProvider;
    this.client = {} as IClient;
  }

  async init() {
    if (this.blockchainRid !== undefined) {
      this.client = await createClient({
        nodeUrlPool: this.clientUrl,
        blockchainRid: this.blockchainRid,
      });
    } else if (this.blockchainIid !== undefined) {
      this.client = await createClient({
        nodeUrlPool: this.clientUrl,
        blockchainIid: this.blockchainIid,
      });
    } else {
      throw new Error("No blockchain identifier provided");
    }
  }

  async createLog(
    log: Log
  ) {
    await this.client.signAndSendUniqueTransaction(
      {
        name: "create_log",
        args: [
          log.sessionId,
          log.chatId,
          log.baseUrl,
          log.requestModel,
          log.requestMessages,
          log.userQuestion,
          log.requestRaw,
          log.responseModel,
          log.assistantReply,
          log.responseRaw,
      ],
    },
      this.signatureProvider
    );
  }

  async getLogs(sessionId: string) {
    return this.client.query({
      name: "get_logs",
      args: { session_id: sessionId },
    });
  }

  async generateSessionId() {
    const sessionId = uuid();
    await this.client.signAndSendUniqueTransaction(
      {
        name: "create_session",
        args: [sessionId],
      },
      this.signatureProvider
    );
    return sessionId;
  }

  async addShortTermMemory({ session_id, role, content }: ShortTermMemory) {
    return this.client.signAndSendUniqueTransaction(
      {
        name: "create_short_term_memory",
        args: [session_id, role, content],
      },
      this.signatureProvider
    );
  }

  async getLongTermMemory(session_id: string) {
    return this.client.query({
      name: "get_long_term_memory",
      args: { session_id },
    });
  }

  async createOrEditLongTermMemory(session_id: string, content: string) {
    return this.client.signAndSendUniqueTransaction(
      {
        name: "create_or_edit_long_term_memory",
        args: [session_id, content],
      },
      this.signatureProvider
    );
  }

  async getLatestShortTermMemories(
    session_id: string,
    n_memories: number = 10
  ) {
    return this.client.query({
      name: "get_latest_short_term_memories",
      args: { session_id, n_memories },
    });
  }

  async createAgent(name: string) {
    return this.client.signAndSendUniqueTransaction(
      {
        name: "create_agent",
        args: [name],
      },
      this.signatureProvider
    );
  }
}
