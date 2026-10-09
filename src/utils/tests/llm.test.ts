import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  getChatModel,
  getAnthropicModel,
  isOrcarouterConfigured,
  ORCAROUTER_BASE_URL,
  ORCAROUTER_DEFAULT_MODEL,
} from "../llm.js";

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.ORCAROUTER_API_KEY;
  delete process.env.ORCAROUTER_BASE_URL;
  delete process.env.ORCAROUTER_MODEL;
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
});

describe("getChatModel", () => {
  it("returns a default ChatOpenAI when OrcaRouter is not configured", () => {
    const model = getChatModel({ model: "o1", streaming: false });
    expect(model).toBeInstanceOf(ChatOpenAI);
    expect(model.model).toBe("o1");
  });

  it("routes through OrcaRouter when ORCAROUTER_API_KEY is set", () => {
    process.env.ORCAROUTER_API_KEY = "sk-orca-test";
    const model = getChatModel({ model: "o1", streaming: false });
    expect(model).toBeInstanceOf(ChatOpenAI);
    expect(model.model).toBe(ORCAROUTER_DEFAULT_MODEL);
    expect(model.apiKey).toBe("sk-orca-test");
    expect(model.clientConfig.baseURL).toBe(ORCAROUTER_BASE_URL);
  });

  it("honors ORCAROUTER_BASE_URL and ORCAROUTER_MODEL overrides", () => {
    process.env.ORCAROUTER_API_KEY = "sk-orca-test";
    process.env.ORCAROUTER_BASE_URL = "https://gateway.example.com/v1";
    process.env.ORCAROUTER_MODEL = "orcarouter/fusion";
    const model = getChatModel({ model: "o1", streaming: false });
    expect(model.model).toBe("orcarouter/fusion");
    expect(model.clientConfig.baseURL).toBe("https://gateway.example.com/v1");
  });
});

describe("getAnthropicModel", () => {
  it("returns a default ChatAnthropic when OrcaRouter is not configured", () => {
    const model = getAnthropicModel({
      model: "claude-sonnet-4-5",
      temperature: 0,
    });
    expect(model).toBeInstanceOf(ChatAnthropic);
    expect(model.modelName).toBe("claude-sonnet-4-5");
  });

  it("routes through OrcaRouter when ORCAROUTER_API_KEY is set", () => {
    process.env.ORCAROUTER_API_KEY = "sk-orca-test";
    const model = getAnthropicModel({
      model: "claude-sonnet-4-5",
      temperature: 0,
    });
    expect(model).toBeInstanceOf(ChatAnthropic);
    expect(model.modelName).toBe(ORCAROUTER_DEFAULT_MODEL);
    expect(model.apiKey).toBe("sk-orca-test");
    // The Anthropic SDK appends `/v1/messages`, so the trailing `/v1` is stripped.
    expect(model.apiUrl).toBe("https://api.orcarouter.ai");
  });
});

describe("isOrcarouterConfigured", () => {
  it("returns false when no key is set", () => {
    expect(isOrcarouterConfigured()).toBe(false);
  });

  it("returns true when ORCAROUTER_API_KEY is set", () => {
    process.env.ORCAROUTER_API_KEY = "sk-orca-test";
    expect(isOrcarouterConfigured()).toBe(true);
  });
});
