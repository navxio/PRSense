import type { DeliveryReporter } from "./types.js";
import type { ReviewSignal } from "@prsense/core";

const BOT_MARKER = "<!-- PRSENSE:REVIEW -->";

export class GitLabReporter implements DeliveryReporter {
  constructor(private token: string) {}

  async deliver(signals: ReviewSignal[], context: { targetUrl: string }) {
    const match = context.targetUrl.match(
      /gitlab\.com\/(.+?)\/([^\/]+)\/-\/merge_requests\/(\d+)/,
    );

    if (!match) throw new Error("Invalid GitLab MR URL");

    const [, group, project, mr] = match;
    const encodedProject = encodeURIComponent(`${group}/${project}`);

    const body = this.buildBody(signals);

    const headers = {
      "PRIVATE-TOKEN": this.token,
      "Content-Type": "application/json",
    };

    // -------------------------------------------------
    // 1️⃣ Fetch existing notes
    // -------------------------------------------------

    const notesRes = await fetch(
      `https://gitlab.com/api/v4/projects/${encodedProject}/merge_requests/${mr}/notes`,
      { headers },
    );

    const raw = await notesRes.json();

    if (!Array.isArray(raw)) {
      throw new Error("Unexpected GitLab API response");
    }
    type GitLabNote = {
      id: number;
      body: string;
    };

    const notes = raw as GitLabNote[];

    const existing = notes.find(
      (n: any) => typeof n.body === "string" && n.body.includes(BOT_MARKER),
    );

    if (existing) {
      // -------------------------------------------------
      // 2️⃣ Update note
      // -------------------------------------------------
      await fetch(
        `https://gitlab.com/api/v4/projects/${encodedProject}/merge_requests/${mr}/notes/${existing.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ body }),
        },
      );
    } else {
      // -------------------------------------------------
      // 3️⃣ Create note
      // -------------------------------------------------
      await fetch(
        `https://gitlab.com/api/v4/projects/${encodedProject}/merge_requests/${mr}/notes`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ body }),
        },
      );
    }
  }

  private buildBody(signals: ReviewSignal[]) {
    if (signals.length === 0) {
      return `${BOT_MARKER}

✅ No significant issues detected.`;
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
