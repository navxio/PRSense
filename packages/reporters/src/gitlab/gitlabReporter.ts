import { Gitlab } from "@gitbeaker/node";
import type { ReviewSignal } from "@prsense/core";
import type { Reporter } from "../types.js";
import type { GitLabCommentTarget } from "./types.js";

export function createGitLabReporter(params: {
  token: string;
  target: GitLabCommentTarget;
}): Reporter {
  const client = new Gitlab({ token });

  return async (signals: ReviewSignal[]) => {
    if (signals.length === 0) return;

    const body = signals
      .map(
        (s) =>
          `**${s.severity.toUpperCase()}** (${Math.round(
            s.confidence * 100,
          )}%): ${s.message}`,
      )
      .join("\n\n");

    await client.MergeRequests.createNote(
      params.target.projectId,
      params.target.mergeRequestIid,
      body,
    );
  };
}
