// packages/workflows/src/review/reviewWorkflow.ts

import { CoreEvents, EventBus, buildReviewPrompt } from "@prsense/core";
import type { ReviewSignal, DiffProvider } from "@prsense/core";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import { PostgresIndexMetadataRepository } from "@prsense/context";
import {
  createOpenAiClient,
  createOllamaClient,
  createGoogleClient,
  createAnthropicClient,
  type LlmClient,
  type LlmUsage,
} from "@prsense/llm";
import type { ReviewWorkflowResult } from "./types.js";
import { validateReviewOutput } from "./validateReviewOutput.js";
import { buildDiffEmbeddingQuery } from "./buildDiffEmbeddingQuery.js";
import { dedupeSignals } from "./dedupeSignals.js";
import { retrieveContext } from "./retrieveContext.js";
import { normalizeSignal } from "./normalizeSignal.js";
import { extractJson } from "./extractJson.js";

export async function runReviewWorkflow({
  config,
  credentials,
  diffProvider,
  eventBus,
}: {
  config: ResolvedConfig;
  credentials: CredentialContext;
  diffProvider: DiffProvider;
  eventBus: EventBus;
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowReviewStarted);

  try {
    // -------------------------------------------------
    // Load diff from provider
    // -------------------------------------------------

    const { diff, revision, repositoryIdentity, metadata } =
      await diffProvider.load();

    const metadataRepository = new PostgresIndexMetadataRepository(
      config.database.url,
    );

    const storedMetadata = await metadataRepository.load(
      repositoryIdentity.provider,
      repositoryIdentity.id,
    );

    let contextualReviewAvailable = false;

    if (storedMetadata) {
      const embeddingMatches =
        storedMetadata.embedding.provider === config.embeddings.provider &&
        storedMetadata.embedding.model === config.embeddings.model;

      if (embeddingMatches) {
        contextualReviewAvailable = true;

        if (storedMetadata.revision.commitSha !== revision) {
          eventBus.emit(CoreEvents.WorkflowReviewIndexOutdated, {
            indexedCommit: storedMetadata.revision.commitSha,
            currentCommit: revision,
          });
        }
      }
    }

    if (!storedMetadata) {
      eventBus.emit(CoreEvents.WorkflowReviewContextUnavailable);
    } else if (!contextualReviewAvailable) {
      eventBus.emit(CoreEvents.WorkflowReviewIndexOutdated, {
        indexedCommit: storedMetadata.revision.commitSha,
        currentCommit: revision,
      });
    } else {
      eventBus.emit(CoreEvents.WorkflowReviewContextAvailable);
    }

    if (diff.files.length === 0) {
      eventBus.emit(CoreEvents.WorkflowReviewFinished);
      return {
        outcome: "success",
        payload: { signals: [] },
      };
    }

    // -------------------------------------------------
    // Retrieve contextual chunks (RAG) if available
    // -------------------------------------------------

    let contextText = "";

    if (contextualReviewAvailable) {
      const retrievalQuery = buildDiffEmbeddingQuery({
        diff,
        ...(metadata?.title ? { title: metadata.title } : {}),
        ...(metadata?.description ? { description: metadata.description } : {}),
      });
      eventBus.emit(CoreEvents.WorkflowReviewContextQueryBuilt, {
        preview: retrievalQuery.slice(0, 500),
      });

      const retrieved = await retrieveContext({
        config,
        query: retrievalQuery,
        repoProvider: repositoryIdentity.provider,
        repoName: repositoryIdentity.id,
        limit: config.context.maxChunks,
        eventBus,
      });

      // context size guard
      const MAX_CONTEXT_CHARS = 20000;

      let accumulated = "";
      for (const chunk of retrieved.chunks) {
        if (accumulated.length + chunk.content.length > MAX_CONTEXT_CHARS)
          break;
        accumulated += chunk.content + "\n\n";
      }

      contextText = accumulated;

      eventBus.emit(CoreEvents.WorkflowReviewContextRetrieved, {
        chunks: retrieved.stats.totalChunks,
        truncated: retrieved.stats.truncated,
        contextChars: contextText.length,
      });
    }

    // -------------------------------------------------
    // Create LLM client
    // -------------------------------------------------

    let llmClient: LlmClient;

    switch (config.llm.provider) {
      case "openai": {
        const apiKey = credentials.openai?.apiKey;
        if (!apiKey) {
          throw new Error("OpenAI credentials missing");
        }

        llmClient = createOpenAiClient({
          apiKey,
          model: config.llm.model,
          temperature: config.llm.temperature,
        });
        break;
      }

      case "google": {
        const apiKey = credentials.google?.apiKey;
        if (!apiKey) {
          throw new Error("Google credentials missing");
        }

        llmClient = createGoogleClient({
          apiKey,
          model: config.llm.model,
          temperature: config.llm.temperature,
        });
        break;
      }

      case "anthropic": {
        const apiKey = credentials.anthropic?.apiKey;
        if (!apiKey) {
          throw new Error("Anthropic credentials missing");
        }

        llmClient = createAnthropicClient({
          apiKey,
          model: config.llm.model,
          temperature: config.llm.temperature,
        });
        break;
      }

      case "ollama":
      default:
        llmClient = createOllamaClient({
          model: config.llm.model,
          temperature: config.llm.temperature,
        });
    }

    // -------------------------------------------------
    // Generate review
    // -------------------------------------------------

    const allSignals: ReviewSignal[] = [];
    let totalUsage: LlmUsage | undefined;

    for (const file of diff.files) {
      // Skip empty or trivial patches
      if (!file.patch || file.patch.length < 40) {
        continue;
      }

      // skip binary/non code files
      if (
        file.path.endsWith(".png") ||
        file.path.endsWith(".jpg") ||
        file.path.endsWith(".svg") ||
        file.path.endsWith(".lock")
      ) {
        continue;
      }

      eventBus.emit(CoreEvents.WorkflowReviewFileStarted, {
        file: file.path,
      });
      const fileDiff = {
        files: [file],
      };
      const prompt = buildReviewPrompt({
        diff: fileDiff,
        context: contextText,
        ...(metadata ?? {}),
      });

      eventBus.emit(CoreEvents.WorkflowReviewPromptBuilt, {
        model: config.llm.model,
        provider: config.llm.provider,
        promptChars: JSON.stringify(prompt).length,
        preview: JSON.stringify(prompt).slice(0, 2000),
      });
      eventBus.emit(CoreEvents.WorkflowReviewLlmRequestStarted);

      const start = Date.now();

      const response = await llmClient.generate({ prompt });

      eventBus.emit(CoreEvents.WorkflowReviewLlmResponseReceived, {
        outputChars: response.text.length,
        usage: response.usage,
        durationMs: Date.now() - start,
      });
      eventBus.emit(CoreEvents.WorkflowReviewLlmRawResponse, {
        preview: response.text.slice(0, 1000),
        fullLength: response.text.length,
      });

      if (response.usage) {
        if (!totalUsage) {
          totalUsage = { ...response.usage };
        } else {
          totalUsage.promptTokens += response.usage.promptTokens;
          totalUsage.completionTokens += response.usage.completionTokens;
          totalUsage.totalTokens += response.usage.totalTokens;
        }
      }

      const cleaned = extractJson(response.text);
      const trimmed = cleaned.trim();
      if (!(trimmed.endsWith("}") || trimmed.endsWith("]}"))) {
        throw new Error("LLM response truncated");
      }

      let parsed: any;

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        eventBus.emit(CoreEvents.WorkflowReviewInvalidJson, {
          rawResponsePreview: response.text.slice(0, 2000),
        });
        throw new Error("LLM returned invalid JSON");
      }
      let validated: ReturnType<typeof validateReviewOutput>;

      try {
        validated = validateReviewOutput(parsed);
      } catch {
        const correctionPrompt = `
The previous output did not match the required schema.

Convert the following into valid JSON matching this schema:

{
  "signals": [
    {
      "type": "bug" | "risk" | "test" | "style",
      "severity": "low" | "medium" | "high",
      "confidence": number,
      "file": string,
      "lineStart": number | null,
      "lineEnd": number | null,
      "message": string,
      "rationale": string | null,
      "suggestedFix": string | null
    }
  ]
}

Output only valid JSON.

Previous output:
${cleaned}
`;

        const retry = await llmClient.generate({
          prompt: {
            system: "You are correcting malformed JSON output.",
            user: correctionPrompt,
          },
        });

        const retryCleaned = extractJson(retry.text);
        parsed = JSON.parse(retryCleaned);
        validated = validateReviewOutput(parsed);
      }

      allSignals.push(...validated.signals);
    }

    // -------------------------------------------------
    // Normalize + filter signals
    // -------------------------------------------------

    const rawSignals = allSignals;

    const normalized = rawSignals
      .map(normalizeSignal)
      .filter((s): s is ReviewSignal => s != null);

    const thresholded = normalized.filter(
      (s) => s.confidence >= config.review.confidenceThreshold,
    );

    const signals = dedupeSignals(thresholded);

    eventBus.emit(CoreEvents.SignalCompiled, {
      count: signals.length,
    });

    eventBus.emit(CoreEvents.WorkflowReviewFinished);

    if (totalUsage) {
      return {
        outcome: "success",
        payload: { signals, usage: totalUsage },
      };
    }
    return {
      outcome: "success",
      payload: { signals },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit(CoreEvents.WorkflowReviewFailed, {
      error: message,
    });

    return {
      outcome: "failure",
      payload: { signals: [] },
    };
  }
}
