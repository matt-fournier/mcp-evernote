/**
 * ENML (Evernote Markup Language) helpers.
 * Converts between plain text and ENML format.
 */

const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape special XML characters in plain text */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch]);
}

/** Convert plain text to a valid ENML document */
export function textToEnml(plainText: string): string {
  const lines = plainText.split("\n");
  const body = lines.map((line) => {
    const escaped = escapeXml(line);
    return escaped.length === 0 ? "<br/>" : `<div>${escaped}</div>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>${body}</en-note>`;
}

/** Convert ENML content to readable plain text (strip XML tags) */
export function enmlToText(enml: string): string {
  // Remove XML declaration and DOCTYPE
  let text = enml
    .replace(/<\?xml[^?]*\?>\s*/g, "")
    .replace(/<!DOCTYPE[^>]*>\s*/g, "");

  // Remove en-note wrapper
  text = text.replace(/<\/?en-note\s*>/g, "");

  // Convert common block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Convert list items
  text = text.replace(/<li[^>]*>/gi, "• ");

  // Convert links: keep the text and URL
  text = text.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi,
    "$2 ($1)",
  );

  // Convert checkboxes
  text = text.replace(/<en-todo\s+checked="true"\s*\/?>/gi, "[x] ");
  text = text.replace(/<en-todo[^>]*\/?>/gi, "[ ] ");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/** Append text content to existing ENML, inserting before closing </en-note> */
export function appendToEnml(existingEnml: string, additionalText: string): string {
  const newContent = additionalText.split("\n").map((line) => {
    const escaped = escapeXml(line);
    return escaped.length === 0 ? "<br/>" : `<div>${escaped}</div>`;
  }).join("\n");

  return existingEnml.replace(
    /<\/en-note>\s*$/,
    `<br/>\n${newContent}\n</en-note>`,
  );
}
