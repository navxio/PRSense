import type { Reporter } from "./types.js";
import type { ReviewSignal } from "@prsense/core";

export class GitHubReporter implements Reporter {
  constructor(private token: string) {}

  async deliver(signals: ReviewSignal[], context: { targetUrl: string }) {
    const match = context.targetUrl.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
    );

    if (!match) {
      throw new Error("Invalid GitHub PR URL");
    }

    const [, owner, repo, pr] = match;

    const body = signals
      .map(
        (s) =>
          `### ${s.severity.toUpperCase()} — ${s.file}

${s.message}

${s.rationale ?? ""}
${s.suggestedFix ? `\n💡 ${s.suggestedFix}` : ""}
`,
      )
      .join("\n---\n");

    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${pr}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      },
    );
  }
}
