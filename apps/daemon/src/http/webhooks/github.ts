//apps/daemon/src/http/webhooks/github.ts
import crypto from "node:crypto";
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

export function registerGitHubWebhook(
  app: FastifyInstance,
  store: JobStore,
  config: ResolvedConfig,
  credentials: CredentialContext,
  logger: Logger,
) {
  app.post(
    "/webhooks/github",
    { config: { rawBody: true } },
    async (req, reply) => {
      const secret = credentials.github?.webhookSecret;
      if (!secret) {
        reply.status(500).send({ error: "Webhook not configured" });
        return;
      }

      const signature = req.headers["x-hub-signature-256"] as string;
      const rawBody = (req as any).rawBody as Buffer;

      if (!signature || !rawBody) {
        reply.status(400).send({ error: "Invalid request" });
        return;
      }

      const expected =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      if (
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
      ) {
        logger.warn("github.webhook.invalid_signature");
        reply.status(401).send({ error: "Invalid signature" });
        return;
      }

      const event = req.headers["x-github-event"];

      if (event !== "pull_request") {
        reply.status(200).send({ ignored: true });
        return;
      }

      const payload = req.body as any;

      if (payload.action !== "opened" && payload.action !== "synchronize") {
        reply.status(200).send({ ignored: true });
        return;
      }

      const prUrl = payload.pull_request?.html_url;
      if (!prUrl) {
        reply.status(400).send({ error: "Malformed PR event" });
        return;
      }

      const jobId = randomUUID();

      store.create({
        id: jobId,
        type: "review",
        state: "queued",
        input: { target: prUrl },
        createdAt: Date.now(),
      });

      runJob(store, logger, jobId, async () =>
        runReviewJob({ target: prUrl }, config, credentials, logger),
      );

      logger.info("github.webhook.job_created", { jobId, prUrl });

      reply.send({ jobId });
    },
  );
}
