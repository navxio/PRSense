export function extractJson(text: string): string {
  // Remove markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  // Otherwise attempt brace extraction
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first !== -1 && last !== -1) {
    return text.slice(first, last + 1);
  }

  return text;
}
