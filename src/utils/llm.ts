import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * OrcaRouter gateway configuration.
 *
 * When `ORCAROUTER_API_KEY` is set, all chat models in this repo are routed
 * through the [OrcaRouter](https://www.orcarouter.ai) gateway instead of the
 * default provider endpoints. The gateway is OpenAI/Anthropic-compatible, so
 * the existing `ChatOpenAI` / `ChatAnthropic` models can be pointed at it with
 * a base URL override. It also runs gateway-level, zero-trust security for AI
 * agents on the same endpoint — screening every prompt/response and governing
 * every tool call on a default-deny basis, with no application code changes.
 *
 * Env vars:
 * - `ORCAROUTER_API_KEY` (required to enable the gateway, `sk-orca-...`)
 * - `ORCAROUTER_BASE_URL` (optional, defaults to `https://api.orcarouter.ai/v1`)
 * - `ORCAROUTER_MODEL` (optional, defaults to `orcarouter/auto`)
 */
export const ORCAROUTER_BASE_URL =
  process.env.ORCAROUTER_BASE_URL ?? "https://api.orcarouter.ai/v1";

export const ORCAROUTER_DEFAULT_MODEL = "orcarouter/auto";

/**
 * Resolve the OrcaRouter gateway base URL. For OpenAI-compatible requests the
 * OpenAI SDK appends `/chat/completions` directly to this value, so the default
 * (`https://api.orcarouter.ai/v1`) is correct. The Anthropic SDK instead
 * appends `/v1/messages`, so the trailing `/v1` is stripped for `ChatAnthropic`.
 */
function orcaBaseUrl(): string {
  return process.env.ORCAROUTER_BASE_URL ?? "https://api.orcarouter.ai/v1";
}

function orcaAnthropicApiUrl(): string {
  const base = orcaBaseUrl();
  return base.replace(/\/v1$/, "");
}

export function isOrcarouterConfigured(): boolean {
  return Boolean(process.env.ORCAROUTER_API_KEY);
}

export interface GetChatModelParams {
  model: string;
  temperature?: number;
  streaming?: boolean;
}

/**
 * Create an OpenAI chat model.
 *
 * If OrcaRouter is configured, the model is pointed at the OrcaRouter gateway
 * (`ORCAROUTER_BASE_URL`) with the `sk-orca-...` key and, unless overridden,
 * the `orcarouter/auto` adaptive model. Otherwise this is exactly the same as
 * `new ChatOpenAI(params)`.
 */
export function getChatModel(params: GetChatModelParams): ChatOpenAI {
  const orcaApiKey = process.env.ORCAROUTER_API_KEY;
  if (orcaApiKey) {
    return new ChatOpenAI({
      model: process.env.ORCAROUTER_MODEL ?? ORCAROUTER_DEFAULT_MODEL,
      temperature: params.temperature,
      streaming: params.streaming ?? true,
      apiKey: orcaApiKey,
      configuration: {
        baseURL: orcaBaseUrl(),
      },
    });
  }
  return new ChatOpenAI(params);
}

export interface GetAnthropicModelParams {
  model: string;
  temperature?: number;
}

/**
 * Create an Anthropic chat model.
 *
 * If OrcaRouter is configured, the model is pointed at the OrcaRouter gateway
 * (`ORCAROUTER_BASE_URL`) with the `sk-orca-...` key and, unless overridden,
 * the `orcarouter/auto` adaptive model. Otherwise this is exactly the same as
 * `new ChatAnthropic(params)`.
 */
export function getAnthropicModel(
  params: GetAnthropicModelParams,
): ChatAnthropic {
  const orcaApiKey = process.env.ORCAROUTER_API_KEY;
  if (orcaApiKey) {
    return new ChatAnthropic({
      model: process.env.ORCAROUTER_MODEL ?? ORCAROUTER_DEFAULT_MODEL,
      temperature: params.temperature,
      apiKey: orcaApiKey,
      anthropicApiUrl: orcaAnthropicApiUrl(),
    });
  }
  return new ChatAnthropic(params);
}
