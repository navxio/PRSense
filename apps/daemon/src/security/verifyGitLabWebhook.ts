import { timingSafeEqual } from "crypto";

export function verifyGitLabWebhook(params: {
  receivedToken: string | undefined;
  expectedToken: string | undefined;
}): boolean {
  const { receivedToken, expectedToken } = params;

  if (!receivedToken || !expectedToken) {
    return false;
  }

  // constant-time comparison to avoid timing attacks
  const a = Buffer.from(receivedToken);
  const b = Buffer.from(expectedToken);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
