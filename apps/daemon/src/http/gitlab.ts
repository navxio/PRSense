import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";

import type { JobStore } from "../jobs/store.js";
import { runJob } from "../jobs/runJob.js";

import { verifyGitLabWebhook } from "../security/verifyGitLabWebhook.js";
import type { GitLabMergeRequestWebhook } from "@prsense/adapters";
//TODO: run required workflow
import { runGitLabReviewJob } from "../jobs/gitlab/runGitLabReviewJob.js";

export function registerGitLabWebhookRoutes(
  app: FastifyInstance,
  store: JobStore,
) {
  app.post("/webhooks/gitlab", async (req, reply) => {
    const receivedToken = req.headers["x-gitlab-token"] as string | undefined;

    const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;

    // 🔐 1️⃣ Verify webhook signature
    if (
      !verifyGitLabWebhook({
        receivedToken,
        expectedToken,
      })
    ) {
      return reply.code(401).send({ error: "Invalid webhook token" });
    }

    const event = req.body as GitLabMergeRequestWebhook;

    // 1️⃣ Only handle merge request events
    if (event.object_kind !== "merge_request") {
      return reply.code(200).send({ ignored: true });
    }

    const mr = event.object_attributes;

    // 2️⃣ Only react to opened / updated MRs
    if (mr.state !== "opened") {
      return reply.code(200).send({ ignored: true });
    }

    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "gitlab-review",
      state: "queued",
      input: {
        projectId: event.project.id,
        mergeRequestIid: mr.iid,

        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,

        title: mr.title,
        description: mr.description,

        author: {
          id: mr.author.id,
          username: mr.author.username,
        },
      },
      createdAt: Date.now(),
    });

    // 3️⃣ Fire-and-forget review job
    runJob(store, jobId, async () => {
      return runGitLabReviewJob(store, jobId);
    });

    return reply.code(200).send({ jobId });
  });
}
