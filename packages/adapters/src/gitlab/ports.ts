// packages/adapters/src/gitlab/ports.ts

import type { ReviewInput } from "@prsense/domain";
import type { GitLabWebhookEvent } from "./types.js";

export type GitLabWebhookHandler = (
  event: GitLabWebhookEvent,
) => Promise<ReviewInput | null>;
