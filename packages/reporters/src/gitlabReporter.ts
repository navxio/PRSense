import type { ReviewSignal } from "@prsense/core";
import type { Reporter } from "./types.js";

export class GitLabReporter implements Reporter {
  constructor(private token: string) {}

  async deliver(signals: ReviewSignal[], context: { targetUrl: string }) {
    const match = context.targetUrl.match(
      /gitlab\.com\/(.+?)\/([^\/]+)\/-\/merge_requests\/(\d+)/,
    );

    if (!match) {
      throw new Error("Invalid GitLab MR URL");
    }

    const [, group, project, mr] = match;

    const encodedProject = encodeURIComponent(`${group}/${project}`);

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
      `https://gitlab.com/api/v4/projects/${encodedProject}/merge_requests/${mr}/notes`,
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      },
    );
  }
}
