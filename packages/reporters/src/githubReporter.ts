import { Octokit } from "@octokit/rest";
import type { DeliveryReporter } from "./types.js";
import type { ReviewSignal } from "@prsense/core";

const BOT_MARKER = "<!-- PRSENSE:REVIEW -->";

export class GitHubReporter implements DeliveryReporter {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async deliver(
    signals: ReviewSignal[],
    context: { targetUrl: string },
  ): Promise<void> {
    const match = context.targetUrl.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
    );

    if (!match) {
      throw new Error("Invalid GitHub PR URL");
    }

    const owner = match[1];
    const repo = match[2];
    const prNumber = Number(match[3]);

    if (!owner || !repo || Number.isNaN(prNumber)) {
      throw new Error("Invalid GitHub PR URL");
    }

    const body = this.buildBody(signals);

    // -------------------------------------------------
    // Fetch existing comments
    // -------------------------------------------------

    const { data: comments } = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    const existing = comments.find(
      (c) => typeof c.body === "string" && c.body.includes(BOT_MARKER),
    );

    if (existing) {
      // -------------------------------------------------
      // Update existing bot comment
      // -------------------------------------------------

      await this.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else {
      // -------------------------------------------------
      // Create new bot comment
      // -------------------------------------------------

      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
    }
  }

  private buildBody(signals: ReviewSignal[]): string {
    if (signals.length === 0) {
      return `${BOT_MARKER}

## PRSense Review

✅ No significant issues detected.
`;
    }

    const content = signals
      .map(
        (s) =>
          `### ${s.severity.toUpperCase()} — ${s.file}

${s.message}

${s.rationale ?? ""}
${s.suggestedFix ? `\n💡 ${s.suggestedFix}` : ""}
`,
      )
      .join("\n---\n");

    return `${BOT_MARKER}

## PRSense Review

${content}
`;
  }
}
