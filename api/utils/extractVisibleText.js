// api/utils/extractVisibleText.js

function extractVisibleText(html) {
  if (!html) return "";

  // Remove scripts/styles/noscript
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // Remove all tags
  s = s.replace(/<[^>]+>/g, " ");

  // Decode minimal HTML entities (add more later if needed)
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  return s;
}

module.exports = { extractVisibleText };
