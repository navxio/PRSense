import type { BenchmarkScenario } from "../types.js";

export const libuvScenario: BenchmarkScenario = {
  id: "libuv_pr_4976",
  description: "Real world C library PR",
  reviewTarget: "https://github.com/libuv/libuv/pull/4976",
};
