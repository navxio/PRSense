//apps/daemon/src/http/webhooks/gitlab.ts
import type { FastifyInstance } from "fastify";
import type { JobStore } from "../../jobs/store.js";
import { randomUUID } from "node:crypto";
import { runJob } from "../../jobs/runJob.js";
import { runReviewJob } from "../../jobs/review/runReviewJob.js";
import type {
  ResolvedConfig,
  CredentialContext,
} from "@prsense/runtime-config";
import type { Logger } from "@prsense/logging";

export function registerGitLabWebhook(
  app: FastifyInstance,
  store: JobStore,
  config: ResolvedConfig,
  credentials: CredentialContext,
  logger: Logger,
) {
  app.post("/webhooks/gitlab", async (req, reply) => {
    const secret = credentials.gitlab?.webhookSecret;
    if (!secret) {
      reply.status(500).send({ error: "Webhook not configured" });
      return;
    }

    const token = req.headers["x-gitlab-token"];

    if (token !== secret) {
      logger.warn("gitlab.webhook.invalid_token");
      reply.status(401).send({ error: "Invalid token" });
      return;
    }

    const payload = req.body as any;

    if (payload.object_kind !== "merge_request") {
      reply.status(200).send({ ignored: true });
      return;
    }

    if (
      payload.object_attributes?.action !== "open" &&
      payload.object_attributes?.action !== "update"
    ) {
      reply.status(200).send({ ignored: true });
      return;
    }

    const mrUrl = payload.object_attributes?.url;
    if (!mrUrl) {
      reply.status(400).send({ error: "Malformed MR event" });
      return;
    }

    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "review",
      state: "queued",
      input: { target: mrUrl },
      createdAt: Date.now(),
    });

    runJob(store, logger, jobId, async () =>
      runReviewJob({ target: mrUrl }, config, credentials, logger),
    );

    logger.info("gitlab.webhook.job_created", { jobId, mrUrl });

    reply.send({ jobId });
  });
}
