// packages/context/src/symbolGraph/sig/compareHeritage.ts
import type { Symbol } from "ts-morph";
import { instanceMembers } from "./structuralMembers.js";

export type MemberBreak =
  | { kind: "drift"; member: string }
  | { kind: "missing"; member: string };

export function compareHeritage(opts: {
  base: Symbol; // X @ base
  head: Symbol; // X @ head
  implementer: Symbol; // C @ head
}): MemberBreak[] {
  const xBase = instanceMembers(opts.base);
  const xHead = instanceMembers(opts.head);
  const c = instanceMembers(opts.implementer);

  const out: MemberBreak[] = [];
  for (const [name, headMarker] of xHead) {
    if (xBase.get(name) === headMarker) continue; // member unchanged in X — skip
    if (!c.has(name)) out.push({ kind: "missing", member: name });
    else if (c.get(name) !== headMarker)
      out.push({ kind: "drift", member: name });
  }
  return out;
}
