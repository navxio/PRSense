// packages/reporters/src/codebergReporter.ts
import type { DeliveryReporter } from "./types.js";
import type { ReviewSignal } from "@prsense/core";

const BOT_MARKER = "<!-- PRSENSE:REVIEW -->";
const RETRYABLE = new Set([502, 503, 504]);

type Comment = { id: number; body: string };

export class CodebergReporter implements DeliveryReporter {
  private readonly apiBase: string;
  private readonly urlPattern: RegExp;

  constructor(
    private readonly token: string,
    host: string = "codeberg.org",
  ) {
    this.apiBase = `https://${host}/api/v1`;
    // Forgejo uses /pulls/ (plural) in web URLs
    this.urlPattern = new RegExp(
      `${host.replace(/\./g, "\\.")}\/([^\/]+)\/([^\/]+)\/pulls\/(\\d+)`,
    );
  }

  async deliver(
    signals: ReviewSignal[],
    context: { targetUrl: string },
  ): Promise<void> {
    const match = context.targetUrl.match(this.urlPattern);
    if (!match) throw new Error("Invalid Codeberg PR URL");

    const owner = match[1];
    const repo = match[2];
    const index = Number(match[3]);
    if (!owner || !repo || Number.isNaN(index)) {
      throw new Error("Invalid Codeberg PR URL");
    }

    const body = this.buildBody(signals);
    const existing = await this.findExistingComment(owner, repo, index);

    if (existing) {
      await this.request(
        `/repos/${owner}/${repo}/issues/comments/${existing.id}`,
        "PATCH",
        { body },
      );
    } else {
      await this.request(
        `/repos/${owner}/${repo}/issues/${index}/comments`,
        "POST",
        { body },
      );
    }
  }

  private async findExistingComment(
    owner: string,
    repo: string,
    index: number,
  ): Promise<Comment | undefined> {
    // Forgejo default limit is 50; PRSense's comment is upserted, so
    // realistically it lands on page 1. Paginate defensively anyway.
    for (let page = 1; page <= 5; page++) {
      const res = await this.request(
        `/repos/${owner}/${repo}/issues/${index}/comments?page=${page}&limit=50`,
        "GET",
      );
      const comments = (await res.json()) as Comment[];
      const hit = comments.find(
        (c) => typeof c.body === "string" && c.body.includes(BOT_MARKER),
      );
      if (hit) return hit;
      if (comments.length < 50) return undefined;
    }
    return undefined;
  }

  private async request(
    path: string,
    method: "GET" | "POST" | "PATCH",
    json?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `token ${this.token}`,
    };
    if (json !== undefined) headers["Content-Type"] = "application/json";

    return this.retry(() =>
      fetch(`${this.apiBase}${path}`, {
        method,
        headers,
        ...(json !== undefined && { body: JSON.stringify(json) }),
      }),
    );
  }

  private async retry(
    fn: () => Promise<Response>,
    attempts = 4,
  ): Promise<Response> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fn();
        if (res.ok) return res;
        if (!RETRYABLE.has(res.status)) {
          throw new Error(`Codeberg API ${res.status}: ${await res.text()}`);
        }
        lastError = new Error(`Codeberg API ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
    throw lastError;
  }

  private buildBody(signals: ReviewSignal[]): string {
    if (signals.length === 0) {
      return `${BOT_MARKER}\n## PRSense Review\n✅ No significant issues detected.\n`;
    }
    const content = signals
      .map(
        (s) =>
          `### ${s.severity.toUpperCase()} — ${s.file}\n${s.message}\n${s.rationale ?? ""}\n${s.suggestedFix ? `\n💡 ${s.suggestedFix}` : ""}\n`,
      )
      .join("\n---\n");
    return `${BOT_MARKER}\n## PRSense Review\n${content}\n`;
  }
}
