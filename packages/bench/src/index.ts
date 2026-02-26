import { runBench } from "./runBench.js";

runBench().catch((err) => {
  console.error(err);
  process.exit(1);
});
