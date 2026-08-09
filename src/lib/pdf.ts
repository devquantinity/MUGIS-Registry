/**
 * PDF export via the browser's print engine — a styled report opens in a new
 * window and the print dialog defaults to "Save as PDF". Dependency-free and
 * prints with proper page breaks and repeated table headers.
 */

export type PdfTable = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  landscape?: boolean;
  footnote?: string;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printPdf(t: PdfTable) {
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) { alert("Allow pop-ups to export PDF."); return; }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>
  @page { size: A4 ${t.landscape ? "landscape" : "portrait"}; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 10px/1.45 -apple-system, "Segoe UI", Arial, sans-serif; color: #1A201C; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: baseline;
          border-bottom: 3px solid #006C38; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 16px; margin: 0; }
  .sub { color: #646E67; font-size: 10px; margin-top: 2px; }
  .brand { font-weight: 800; letter-spacing: 2px; color: #006C38; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #006C38; color: #fff; text-align: left; padding: 5px 6px;
       font-size: 8.5px; text-transform: ; letter-spacing: 0.04em;
       -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 4px 6px; border-bottom: 1px solid #E2E7E2; font-size: 9px; vertical-align: top; }
  tr:nth-child(even) td { background: #F7F9F7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr { page-break-inside: avoid; }
  .foot { margin-top: 10px; color: #646E67; font-size: 8.5px; font-style: italic; }
</style></head><body>
<div class="head">
  <div><h1>${esc(t.title)}</h1>${t.subtitle ? `<div class="sub">${esc(t.subtitle)}</div>` : ""}</div>
  <div class="brand">MUGIS · UPPER GI REGISTRY</div>
</div>
<table><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
${t.footnote ? `<div class="foot">${esc(t.footnote)}</div>` : ""}
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}
