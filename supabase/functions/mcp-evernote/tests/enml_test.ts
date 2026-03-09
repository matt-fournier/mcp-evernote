import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { textToEnml, enmlToText, escapeXml, appendToEnml } from "../evernote/enml.ts";

Deno.test("escapeXml escapes special characters", () => {
  assertEquals(escapeXml("Hello & World"), "Hello &amp; World");
  assertEquals(escapeXml("<script>alert('xss')</script>"), "&lt;script&gt;alert(&apos;xss&apos;)&lt;/script&gt;");
  assertEquals(escapeXml('He said "hello"'), "He said &quot;hello&quot;");
});

Deno.test("escapeXml leaves plain text unchanged", () => {
  assertEquals(escapeXml("Hello World"), "Hello World");
  assertEquals(escapeXml(""), "");
});

Deno.test("textToEnml wraps plain text in valid ENML", () => {
  const enml = textToEnml("Hello World");
  assertStringIncludes(enml, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(enml, "<!DOCTYPE en-note");
  assertStringIncludes(enml, "<en-note>");
  assertStringIncludes(enml, "</en-note>");
  assertStringIncludes(enml, "<div>Hello World</div>");
});

Deno.test("textToEnml converts newlines to div elements", () => {
  const enml = textToEnml("Line 1\nLine 2\nLine 3");
  assertStringIncludes(enml, "<div>Line 1</div>");
  assertStringIncludes(enml, "<div>Line 2</div>");
  assertStringIncludes(enml, "<div>Line 3</div>");
});

Deno.test("textToEnml converts empty lines to br tags", () => {
  const enml = textToEnml("Line 1\n\nLine 3");
  assertStringIncludes(enml, "<div>Line 1</div>");
  assertStringIncludes(enml, "<br/>");
  assertStringIncludes(enml, "<div>Line 3</div>");
});

Deno.test("textToEnml escapes special characters in content", () => {
  const enml = textToEnml("Price: $10 & tax < $2");
  assertStringIncludes(enml, "Price: $10 &amp; tax &lt; $2");
});

Deno.test("enmlToText strips ENML tags and returns plain text", () => {
  const enml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>Hello World</div><div>Second line</div></en-note>`;

  const text = enmlToText(enml);
  assertStringIncludes(text, "Hello World");
  assertStringIncludes(text, "Second line");
});

Deno.test("enmlToText converts br to newlines", () => {
  const enml = `<en-note>Line 1<br/>Line 2</en-note>`;
  const text = enmlToText(enml);
  assertStringIncludes(text, "Line 1\nLine 2");
});

Deno.test("enmlToText converts links to text with URL", () => {
  const enml = `<en-note><a href="https://example.com">Click here</a></en-note>`;
  const text = enmlToText(enml);
  assertStringIncludes(text, "Click here (https://example.com)");
});

Deno.test("enmlToText converts checkboxes", () => {
  const enml = `<en-note><en-todo checked="true"/>Done<br/><en-todo/>Not done</en-note>`;
  const text = enmlToText(enml);
  assertStringIncludes(text, "[x] Done");
  assertStringIncludes(text, "[ ] Not done");
});

Deno.test("enmlToText decodes HTML entities", () => {
  const enml = `<en-note><div>A &amp; B &lt; C</div></en-note>`;
  const text = enmlToText(enml);
  assertStringIncludes(text, "A & B < C");
});

Deno.test("enmlToText handles unicode", () => {
  const enml = `<en-note><div>Café résumé naïve</div></en-note>`;
  const text = enmlToText(enml);
  assertStringIncludes(text, "Café résumé naïve");
});

Deno.test("enmlToText produces no XML tags in output", () => {
  const enml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>Hello</div><p>World</p><br/><b>Bold</b><i>Italic</i></en-note>`;

  const text = enmlToText(enml);
  assertEquals(text.includes("<"), false, "Output should not contain '<'");
  assertEquals(text.includes(">"), false, "Output should not contain '>'");
});

Deno.test("roundtrip: text → ENML → text preserves content", () => {
  const original = "Hello World\nSecond line\nThird line";
  const enml = textToEnml(original);
  const result = enmlToText(enml);
  assertStringIncludes(result, "Hello World");
  assertStringIncludes(result, "Second line");
  assertStringIncludes(result, "Third line");
});

Deno.test("appendToEnml adds content before closing tag", () => {
  const existing = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>Original</div></en-note>`;

  const result = appendToEnml(existing, "Appended text");
  assertStringIncludes(result, "<div>Original</div>");
  assertStringIncludes(result, "<div>Appended text</div>");
  assertStringIncludes(result, "</en-note>");
});
