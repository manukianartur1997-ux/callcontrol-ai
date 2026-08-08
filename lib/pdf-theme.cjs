// Shared pdfkit setup for every PDF the site hands to a prospect.
//
// Extracted so the sample report and the one-pager cannot drift into looking
// like two different companies' documents. Both are things a sales lead opens
// before deciding whether to reply.

const path = require("path");

// pdfkit's built-in "Helvetica" etc. are the 14 standard PDF fonts, which only
// cover WinAnsi (Latin-1) — they silently drop Cyrillic rather than erroring,
// so a UA/RU document renders as blanks. DejaVu Sans has full Cyrillic
// coverage and a redistribution-friendly license (Bitstream Vera derivative).
const fontsDir = path.dirname(require.resolve("dejavu-fonts-ttf/package.json"));

const FONTS = {
  regular: path.join(fontsDir, "ttf", "DejaVuSans.ttf"),
  bold: path.join(fontsDir, "ttf", "DejaVuSans-Bold.ttf"),
  oblique: path.join(fontsDir, "ttf", "DejaVuSans-Oblique.ttf")
};

// Same tokens as mini-audit-template.html, so the on-site preview, the sample
// report and the one-pager read as one family rather than three redesigns.
const COLORS = {
  ink: "#0f2034",
  muted: "#52687d",
  line: "#cad8e5",
  blue: "#0369a1",
  red: "#be123c",
  card: "#ffffff",
  bg: "#f4f8fb"
};

// pdfkit streams; every generator needs the same collect-to-Buffer dance.
function renderToBuffer(build) {
  const PDFDocument = require("pdfkit");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

module.exports = { FONTS, COLORS, renderToBuffer, contentWidth };
