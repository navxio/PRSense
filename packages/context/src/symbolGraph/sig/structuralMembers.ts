// packages/context/src/symbolGraph/sig/structuralMembers.ts
import { Node, type Symbol, type Signature } from "ts-morph";

export type StructuralMembers = {
  callSigs: string[];
  constructSigs: string[];
  props: Map<string, string>; // name -> `?:type` marker folded in
};

export function structuralMembers(symbol: Symbol): StructuralMembers {
  const decl = symbol.getDeclarations()[0];
  if (!decl) {
    return { callSigs: [], constructSigs: [], props: new Map() };
  }

  const isPureType =
    Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl);
  const type = isPureType
    ? symbol.getDeclaredType()
    : symbol.getTypeAtLocation(decl);

  const callSigs = type.getCallSignatures().map((s) => renderSignature(s));
  const constructSigs = type
    .getConstructSignatures()
    .map((s) => renderSignature(s));

  const props = new Map<string, string>();
  for (const p of type.getProperties()) {
    const optional = p.isOptional() ? "?" : "";
    props.set(
      p.getName(),
      `${optional}:${p.getTypeAtLocation(decl).getText()}`,
    );
  }

  return { callSigs, constructSigs, props };
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
