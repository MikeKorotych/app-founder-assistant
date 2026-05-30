import type OpenAI from "openai";

/**
 * Provider seam + OpenAI-format types. The pipeline depends on `LlmProvider`,
 * never on a concrete SDK — so the gateway (LiteLLM today) can be swapped
 * without touching agent code.
 */

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmResponse {
  content: string;
  model: string;
}

type SdkMessageRole = OpenAI.Chat.Completions.ChatCompletionMessageParam["role"];

export const LlmChatMessageRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
  Tool: "tool",
} as const satisfies Record<string, SdkMessageRole>;
export type LlmChatMessageRole = (typeof LlmChatMessageRole)[keyof typeof LlmChatMessageRole];

type SdkContentBlockType = OpenAI.Chat.Completions.ChatCompletionContentPartText["type"];

export const LlmContentBlockType = {
  Text: "text",
} as const satisfies Record<string, SdkContentBlockType>;
export type LlmContentBlockType = (typeof LlmContentBlockType)[keyof typeof LlmContentBlockType];

export const LlmToolCallType = {
  Function: "function",
} as const;
export type LlmToolCallType = (typeof LlmToolCallType)[keyof typeof LlmToolCallType];

export const CacheControlType = {
  Ephemeral: "ephemeral",
} as const;
export type CacheControlType = (typeof CacheControlType)[keyof typeof CacheControlType];

export const CacheControlTtl = {
  FiveMin: "5m",
  OneHour: "1h",
} as const;
export type CacheControlTtl = (typeof CacheControlTtl)[keyof typeof CacheControlTtl];

export interface LlmChatContentBlock {
  type: LlmContentBlockType;
  text: string;
  cacheControl?: { ttl: CacheControlTtl };
}

export interface LlmToolDefinition {
  type: LlmToolCallType;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id: string;
  type: LlmToolCallType;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmChatMessage {
  role: LlmChatMessageRole;
  content: string | LlmChatContentBlock[] | null;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
}

export interface LlmChatRequest {
  messages: LlmChatMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  tools?: LlmToolDefinition[];
}

export interface LlmChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
}

export interface LlmChatResponse {
  content: string | null;
  model: string;
  usage: LlmChatUsage;
  toolCalls?: LlmToolCall[];
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
}
