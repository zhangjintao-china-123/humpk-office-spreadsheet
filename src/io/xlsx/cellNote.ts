export function excelNoteText(note: unknown): string {
  if (!note) {
    return "";
  }
  if (typeof note === "string") {
    return note;
  }
  if (typeof note !== "object") {
    return "";
  }
  const texts = (note as { texts?: Array<{ text?: string }> }).texts;
  if (!Array.isArray(texts)) {
    return "";
  }
  return texts.map((part) => part.text ?? "").join("");
}
