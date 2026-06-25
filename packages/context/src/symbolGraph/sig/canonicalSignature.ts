// packages/context/src/symbolGraph/sig/canonicalSignature.ts
import { Node, type Symbol, type Signature } from "ts-morph";

export function canonicalSignature(symbol: Symbol): string {
  const decl = symbol.getDeclarations()[0];
  if (!decl) return `missing:${symbol.getName()}`;

  // Interfaces and type aliases carry their structure on the declared
  // type; they have no value side, so getTypeAtLocation returns nothing
  // useful. Value-bearing declarations (function, class, const) carry
  // call/construct signatures on the value type at the declaration site.
  const isPureType =
    Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl);
  const type = isPureType
    ? symbol.getDeclaredType()
    : symbol.getTypeAtLocation(decl);

  const parts: string[] = [];

  for (const sig of type.getCallSignatures()) {
    parts.push(`call${renderSignature(sig)}`);
  }
  for (const sig of type.getConstructSignatures()) {
    parts.push(`new${renderSignature(sig)}`);
  }

  const props = type.getProperties();
  if (props.length > 0) {
    const rendered = props.map((p) => {
      const propType = p.getTypeAtLocation(decl).getText();
      const optional = p.isOptional() ? "?" : "";
      return `${p.getName()}${optional}:${propType}`;
    });
    rendered.sort();
    parts.push(`props{${rendered.join(",")}}`);
  }

  if (parts.length === 0) return `type:${type.getText()}`;
  return parts.join("|");
}

function renderSignature(sig: Signature): string {
  const typeParams = sig.getTypeParameters().map((tp) => {
    const constraint = tp.getConstraint();
    return constraint
      ? `${tp.getText()} extends ${constraint.getText()}`
      : tp.getText();
  });

  const params = sig.getParameters().map((p) => {
    const d = p.getDeclarations()[0];
    if (!d || !Node.isParameterDeclaration(d)) {
      return d ? p.getTypeAtLocation(d).getText() : "unknown";
    }
    const rest = d.isRestParameter() ? "..." : "";
    const optional = d.hasQuestionToken() ? "?" : "";
    return `${rest}${d.getType().getText()}${optional}`;
  });

  const returnType = sig.getReturnType().getText();
  const tp = typeParams.length ? `<${typeParams.join(",")}>` : "";
  return `${tp}(${params.join(",")}):${returnType}`;
}
