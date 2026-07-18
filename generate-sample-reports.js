// Turns the sample-report markdown strings (defined in
// generate-public-landing-live.js) into two real, rendered artifacts:
//   - a styled HTML preview page (reusing mini-audit-template.html's visual
//     system: same color tokens, card layout, quote/CTA styling)
//   - an actual downloadable PDF, generated with pdfkit (no headless
//     browser, no "print this page" instructions)
//
// Both are derived from the exact same markdown source so the .md, the
// on-site preview, and the PDF can never drift from each other.
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// pdfkit's built-in "Helvetica" etc. are the 14 standard PDF fonts, which
// only support WinAnsi (Latin-1) glyphs - they silently cannot render
// Cyrillic. The sample reports are RU/UK, so a real Unicode TTF has to be
// embedded instead. DejaVu Sans has full Cyrillic coverage and a
// redistribution-friendly license (Bitstream Vera derivative).
const fontsDir = path.dirname(require.resolve("dejavu-fonts-ttf/package.json"));
const FONTS = {
  regular: path.join(fontsDir, "ttf", "DejaVuSans.ttf"),
  bold: path.join(fontsDir, "ttf", "DejaVuSans-Bold.ttf"),
  oblique: path.join(fontsDir, "ttf", "DejaVuSans-Oblique.ttf")
};

// Same color tokens as mini-audit-template.html, reused so the sample
// report and the real one-page mini-audit look like one family, not a
// redesign.
const COLORS = {
  ink: "#0f2034",
  muted: "#52687d",
  line: "#cad8e5",
  blue: "#0369a1",
  red: "#be123c",
  card: "#ffffff",
  bg: "#f4f8fb"
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Parses the small, consistent markdown dialect used for the sample
// reports: "# title", a "**bold note**" line, "## section" headings,
// "> quote" lines, "1. list" items, and plain paragraphs.
function parseSampleMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  const report = { title: "", note: "", sections: [] };
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      report.title = line.slice(2).trim();
    } else if (/^\*\*.*\*\*$/.test(line)) {
      report.note = line.replace(/^\*\*|\*\*$/g, "");
    } else if (line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), paragraphs: [], quotes: [], list: [] };
      report.sections.push(current);
    } else if (line.startsWith(">")) {
      // Source markdown uses a bare ">" as a blank line between two quotes
      // (e.g. "> Manager: ...\n>\n> Client: ...") - skip it instead of
      // rendering a stray ">" paragraph.
      const quote = line.slice(1).trim();
      if (current && quote) current.quotes.push(quote);
    } else if (/^\d+\.\s/.test(line)) {
      if (current) current.list.push(line.replace(/^\d+\.\s/, "").trim());
    } else if (current) {
      current.paragraphs.push(line);
    }
  }

  return report;
}

function renderSectionHtml(section) {
  const parts = [`<h2>${esc(section.heading)}</h2>`];
  for (const paragraph of section.paragraphs) parts.push(`<p>${esc(paragraph)}</p>`);
  for (const quote of section.quotes) parts.push(`<div class="quote">${esc(quote)}</div>`);
  if (section.list.length) {
    parts.push(`<ol>${section.list.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`);
  }
  return `<div class="card wide">${parts.join("")}</div>`;
}

function renderSampleReportHtml(report, meta) {
  const sections = report.sections.map(renderSectionHtml).join("");
  return `<!doctype html>
<html lang="${esc(meta.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(report.title)}</title>
  <meta name="description" content="${esc(report.note)}" />
  <style>
    @page { size: A4; margin: 12mm; }
    :root { --bg:${COLORS.bg}; --ink:${COLORS.ink}; --muted:${COLORS.muted}; --line:${COLORS.line}; --blue:${COLORS.blue}; --red:${COLORS.red}; --card:${COLORS.card}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    main { max-width: 860px; margin: 0 auto; padding: 32px 22px 56px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid var(--ink); margin-bottom: 18px; flex-wrap: wrap; }
    .brand { color: var(--blue); font-weight: 850; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; }
    h1 { margin: 6px 0 6px; font-size: 30px; line-height: 1.08; letter-spacing: -0.03em; }
    .note { display: inline-flex; margin-top: 4px; padding: 6px 10px; border-radius: 999px; background: rgba(180,83,9,.12); color: #b45309; font-size: 12px; font-weight: 700; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .cta { padding: 10px 14px; border-radius: 8px; background: var(--blue); color: #fff; font-weight: 800; text-decoration: none; font-size: 13px; white-space: nowrap; }
    .cta.ghost { background: transparent; border: 1px solid var(--line); color: var(--ink); }
    .card { border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; background: #fbfdff; margin-bottom: 12px; }
    h2 { margin: 0 0 8px; font-size: 16px; letter-spacing: -0.02em; }
    p { margin: 0 0 8px; color: var(--muted); }
    .quote { margin: 10px 0; padding: 12px 14px; border-left: 4px solid var(--red); background: #fff1f2; color: #9f1239; font-weight: 600; border-radius: 0 8px 8px 0; }
    ol { margin: 8px 0 0; padding-left: 20px; color: var(--ink); }
    li { margin: 5px 0; }
    .footer { margin-top: 20px; padding: 16px 18px; border-radius: 10px; background: var(--ink); color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .footer p { color: #c8d5e1; margin: 0; }
    @media print { body { background: #fff; } .actions { display: none; } }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <div class="brand">${esc(meta.brandLabel)}</div>
        <h1>${esc(report.title)}</h1>
        <span class="note">${esc(report.note)}</span>
      </div>
      <div class="actions">
        <a class="cta" href="${esc(meta.pdfHref)}">${esc(meta.downloadLabel)}</a>
        <a class="cta ghost" href="${esc(meta.backHref)}">${esc(meta.backLabel)}</a>
      </div>
    </div>
    ${sections}
    <div class="footer">
      <p>${esc(meta.footerNote)}</p>
      <a class="cta" href="${esc(meta.requestHref)}">${esc(meta.requestLabel)}</a>
    </div>
  </main>
</body>
</html>`;
}

function renderSampleReportPdf(report, meta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.blue)
      .text(String(meta.brandLabel || "CallControl AI · Sample Report").toUpperCase(), { characterSpacing: 1.2 });
    doc.moveDown(0.4);
    doc.font(FONTS.bold).fontSize(22).fillColor(COLORS.ink).text(report.title);
    doc.moveDown(0.3);
    doc.font(FONTS.oblique).fontSize(10).fillColor("#b45309").text(report.note);
    doc.moveDown(0.8);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(1.4).strokeColor(COLORS.ink).stroke();
    doc.moveDown(1);

    for (const section of report.sections) {
      doc.font(FONTS.bold).fontSize(13).fillColor(COLORS.ink).text(section.heading);
      doc.moveDown(0.3);
      for (const paragraph of section.paragraphs) {
        doc.font(FONTS.regular).fontSize(11).fillColor(COLORS.muted).text(paragraph, { lineGap: 2 });
        doc.moveDown(0.2);
      }
      for (const quote of section.quotes) {
        const quoteY = doc.y;
        doc.font(FONTS.oblique).fontSize(11).fillColor(COLORS.red)
          .text(quote, doc.x + 12, quoteY, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 12 });
        doc.moveTo(doc.x - 2, quoteY - 2).lineTo(doc.x - 2, doc.y)
          .lineWidth(3).strokeColor(COLORS.red).stroke();
        doc.moveDown(0.2);
      }
      if (section.list.length) {
        doc.font(FONTS.regular).fontSize(11).fillColor(COLORS.ink);
        section.list.forEach((item, index) => {
          doc.text(`${index + 1}. ${item}`, { lineGap: 2 });
        });
      }
      doc.moveDown(0.8);
    }

    doc.moveDown(0.4);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(0.75).strokeColor(COLORS.line).stroke();
    doc.moveDown(0.6);
    doc.font(FONTS.regular).fontSize(10).fillColor(COLORS.muted).text(meta.footerNote);
    doc.moveDown(0.3);
    doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.blue)
      .text(meta.requestUrl, { link: meta.requestUrl, underline: true });

    doc.end();
  });
}

// samples: { "<file>.md": "<markdown>" } as defined in
// generate-public-landing-live.js. localeMeta maps each sample file to the
// small bits of chrome text needed around the rendered report (labels,
// hrefs). Returns a Promise that resolves once every .html/.pdf pair has
// been written next to the existing .md files.
async function generateSampleReports(samplesDir, samples, localeMeta) {
  for (const [file, markdown] of Object.entries(samples)) {
    const report = parseSampleMarkdown(markdown);
    const meta = localeMeta[file] || localeMeta.default;
    const baseName = file.replace(/\.md$/, "");

    const html = renderSampleReportHtml(report, {
      lang: meta.lang,
      pdfHref: `/samples/${baseName}.pdf`,
      backHref: meta.backHref,
      backLabel: meta.backLabel,
      downloadLabel: meta.downloadLabel,
      requestHref: meta.requestHref,
      requestLabel: meta.requestLabel,
      footerNote: meta.footerNote,
      brandLabel: meta.brandLabel
    });
    fs.writeFileSync(path.join(samplesDir, `${baseName}.html`), html);

    const pdf = await renderSampleReportPdf(report, {
      footerNote: meta.footerNote,
      requestUrl: meta.requestUrl,
      brandLabel: meta.brandLabel
    });
    fs.writeFileSync(path.join(samplesDir, `${baseName}.pdf`), pdf);
  }
}

module.exports = { generateSampleReports, parseSampleMarkdown, renderSampleReportHtml, renderSampleReportPdf };
