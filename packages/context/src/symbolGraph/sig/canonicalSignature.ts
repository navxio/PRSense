// packages/context/src/symbolGraph/sig/canonicalSignature.ts
import type { Symbol } from "ts-morph";
import { structuralMembers } from "./structuralMembers.js";

export function canonicalSignature(symbol: Symbol): string {
  const { callSigs, constructSigs, props, typeText } =
    structuralMembers(symbol);

  const parts: string[] = [];
  for (const s of callSigs) parts.push(`call${s}`);
  for (const s of constructSigs) parts.push(`new${s}`);

  if (props.size > 0) {
    const rendered = [...props].map(([name, marker]) => `${name}${marker}`);
    rendered.sort();
    parts.push(`props{${rendered.join(",")}}`);
  }

  if (parts.length === 0) {
    return typeText ? `type:${typeText}` : `missing:${symbol.getName()}`;
  }
  return parts.join("|");
}
