import { Gitlab } from "@gitbeaker/node";
import type { GitLabApi } from "./port.js";

export function createGitLabApi(token: string): GitLabApi {
  const client = new Gitlab({ token });

  return {
    async fetchMergeRequestDiff({ projectId, mergeRequestIid }) {
      const diffs = await client.MergeRequests.changes(
        projectId,
        mergeRequestIid,
      );

      return diffs.changes
        .map((c) => `diff --git a/${c.old_path} b/${c.new_path}\n${c.diff}`)
        .join("\n");
    },
  };
}
