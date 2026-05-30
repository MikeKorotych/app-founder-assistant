import {
  ErrorFallback,
  OutboundAuthError,
  OutboundError,
  OutboundErrorKind,
  OutboundRateLimitError,
  OutboundService,
  OutboundTransportError,
  toErrorMessage,
} from "@hahaton/outbound";
import OpenAI from "openai";
import { createGatewayClient, type GatewayClientConfig } from "./gateway-client.factory";
import {
  CacheControlTtl,
  CacheControlType,
  LlmChatMessageRole,
  type LlmChatRequest,
  type LlmChatResponse,
  LlmContentBlockType,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type LlmToolCall,
  LlmToolCallType,
} from "./llm-provider";

const LLM_CALL_CONTEXT = "llm-call";

/**
 * Talks to the LiteLLM proxy via the openai SDK. Retry is the SDK's job;
 * this layer only MAPS openai errors into the shared `Outbound*Error` taxonomy
 * (see `@hahaton/outbound`) and re-throws — no withRetry, no CircuitBreaker on
 * the user-driven LLM path (decision D-002).
 */
export class LiteLlmProvider implements LlmProvider {
  readonly name = "LiteLLM";
  private readonly client: OpenAI;

  constructor(config: GatewayClientConfig) {
    this.client = createGatewayClient(config);
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages: [
          { role: LlmChatMessageRole.System, content: request.systemPrompt },
          { role: LlmChatMessageRole.User, content: request.userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw this.emptyResponseError();
      }

      return { content, model: response.model };
    } catch (error: unknown) {
      if (error instanceof OutboundError) throw error;
      this.handleApiError(error);
    }
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    try {
      const messages = request.messages.map((m) => {
        if (m.role === LlmChatMessageRole.Tool) {
          return {
            role: LlmChatMessageRole.Tool,
            tool_call_id: m.toolCallId ?? "",
            content: typeof m.content === "string" ? m.content : "",
          };
        }

        if (m.role === LlmChatMessageRole.Assistant && m.toolCalls?.length) {
          return {
            role: LlmChatMessageRole.Assistant,
            content: m.content ?? null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: LlmToolCallType.Function,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };
        }

        if (typeof m.content === "string") {
          return { role: m.role, content: m.content };
        }

        if (m.content === null) {
          return { role: m.role, content: "" };
        }

        return {
          role: m.role,
          content: m.content.map((block) => ({
            type: LlmContentBlockType.Text,
            text: block.text,
            ...(block.cacheControl
              ? {
                  cache_control: {
                    type: CacheControlType.Ephemeral,
                    ...(block.cacheControl.ttl === CacheControlTtl.OneHour
                      ? { ttl: CacheControlTtl.OneHour }
                      : {}),
                  },
                }
              : {}),
          })),
        };
      });

      const createParams: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages,
      };

      if (request.tools?.length) {
        createParams.tools = request.tools;
      }

      const response = await this.client.chat.completions.create(
        createParams as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      );

      const message = response.choices[0]?.message;
      const content = message?.content ?? null;
      const rawToolCalls = message?.tool_calls;

      if (!content && (!rawToolCalls || rawToolCalls.length === 0)) {
        throw this.emptyResponseError();
      }

      const toolCalls: LlmToolCall[] | undefined = rawToolCalls?.length
        ? rawToolCalls
            .filter(
              (
                tc,
              ): tc is typeof tc & {
                type: typeof LlmToolCallType.Function;
                function: { name: string; arguments: string };
              } => tc.type === LlmToolCallType.Function && "function" in tc,
            )
            .map((tc) => ({
              id: tc.id,
              type: LlmToolCallType.Function,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }))
        : undefined;

      const usage = response.usage as
        | {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
            prompt_tokens_details?: {
              cached_tokens?: number;
              cache_write_tokens?: number;
            };
            cost?: number;
          }
        | undefined;

      return {
        content,
        model: request.model,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
          cacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens ?? 0,
          costUsd: usage?.cost ?? null,
        },
        toolCalls,
      };
    } catch (error: unknown) {
      if (error instanceof OutboundError) throw error;
      this.handleApiError(error);
    }
  }

  private emptyResponseError(): OutboundError {
    return new OutboundError({
      service: OutboundService.Litellm,
      kind: OutboundErrorKind.Unknown,
      retryable: false,
      context: LLM_CALL_CONTEXT,
      message: "LLM returned empty response",
    });
  }

  private handleApiError(error: unknown): never {
    if (error instanceof OpenAI.AuthenticationError) {
      throw new OutboundAuthError({
        service: OutboundService.Litellm,
        context: LLM_CALL_CONTEXT,
        status: error.status,
        message: error.message,
        cause: error,
      });
    }

    if (error instanceof OpenAI.RateLimitError) {
      throw new OutboundRateLimitError({
        service: OutboundService.Litellm,
        context: LLM_CALL_CONTEXT,
        retryAfterMs: null,
        message: error.message,
        cause: error,
      });
    }

    if (error instanceof OpenAI.APIError) {
      throw new OutboundTransportError({
        service: OutboundService.Litellm,
        context: LLM_CALL_CONTEXT,
        status: error.status,
        message: error.message,
        cause: error,
      });
    }

    throw new OutboundError({
      service: OutboundService.Litellm,
      kind: OutboundErrorKind.Unknown,
      retryable: false,
      context: LLM_CALL_CONTEXT,
      message: toErrorMessage(error, ErrorFallback.Unknown),
      cause: error,
    });
  }
}
