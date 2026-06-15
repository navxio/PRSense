// packages/context/src/symbolGraph/SymbolGraphContextProvider.ts
import {
  type ContextAvailabilityInput,
  type ContextChunk,
  type ContextInput,
  type ContextProvider,
} from "@prsense/core";

export class SymbolGraphContextProvider implements ContextProvider {
  readonly name = "symbol-graph";

  constructor(
    private readonly deps: {
      repoRoot: string;
    },
  ) {}

  async isAvailable(_input: ContextAvailabilityInput): Promise<boolean> {
    // Step 4: TS-in-diff + tsconfig-resolvable + file-scoped candidate gate.
    return false;
  }

  async getContextForFile(_input: ContextInput): Promise<ContextChunk[]> {
    // Steps 5–8: lazy-load HEAD + base Projects, resolved-type signature
    // diff per candidate, reference query, snippet render.
    return [];
  }
}
