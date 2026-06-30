// packages/llm/src/providers/__tests__/openai.test.ts
import { describe, it, expect, jest } from "@jest/globals";
import OpenAI from "openai";

import { createOpenAiClient } from "../openai.js";
import { LlmError } from "../../types.js";

function mockCreate(impl: (req: any) => Promise<any>) {
  const create = jest.fn(impl);
  const client = {
    chat: { completions: { create } },
  } as unknown as OpenAI;
  return { client, create };
}

function okResponse(text = "ok") {
  return {
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

function temperature400() {
  return new OpenAI.APIError(
    400,
    {
      message:
        "Unsupported value: 'temperature' does not support 0.05 with this model. Only the default (1) value is supported.",
      type: "invalid_request_error",
      code: "unsupported_value",
    },
    undefined,
    new Headers(),
  );
}
const prompt = { system: "s", user: "u" };

describe("createOpenAiClient temperature resilience", () => {
  it("sends temperature on the happy path", async () => {
    const { client, create } = mockCreate(async () => okResponse());
    const llm = createOpenAiClient({
      apiKey: "k",
      model: "temp-ok-model",
      client,
    });

    await llm.generate({ prompt });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toHaveProperty("temperature");
  });

  it("retries without temperature on the unsupported_value 400", async () => {
    const { client, create } = mockCreate(async (req) => {
      if ("temperature" in req) throw temperature400();
      return okResponse("recovered");
    });
    const llm = createOpenAiClient({
      apiKey: "k",
      model: "temp-reject-model",
      client,
    });

    const res = await llm.generate({ prompt });

    expect(res.text).toBe("recovered");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0]).toHaveProperty("temperature");
    expect(create.mock.calls[1]![0]).not.toHaveProperty("temperature");
  });

  it("memoizes the rejection so later calls skip temperature outright", async () => {
    const { client, create } = mockCreate(async (req) => {
      if ("temperature" in req) throw temperature400();
      return okResponse();
    });
    const llm = createOpenAiClient({
      apiKey: "k",
      model: "temp-memo-model",
      client,
    });

    await llm.generate({ prompt }); // pays the retry: 2 calls
    await llm.generate({ prompt }); // skips temperature: 1 call

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[2]![0]).not.toHaveProperty("temperature");
  });

  it("surfaces unrelated 400s through LlmError without retrying", async () => {
    const badModel = new OpenAI.APIError(
      400,
      {
        message: "The model 'nope' does not exist",
        type: "invalid_request_error",
        code: "model_not_found",
      },
      undefined,
      new Headers(),
    );
    const { client, create } = mockCreate(async () => {
      throw badModel;
    });
    const llm = createOpenAiClient({
      apiKey: "k",
      model: "temp-unrelated-model",
      client,
    });

    await expect(llm.generate({ prompt })).rejects.toBeInstanceOf(LlmError);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
