/**
 * Invoice PDF, written by hand.
 *
 * The Worker has no DOM, and pulling a PDF library into the bundle for one
 * single-page invoice of text and rules is not worth the weight — the PDF format
 * for that case is a few hundred bytes of objects and a content stream.
 *
 * Everything is WinAnsi-safe ASCII (the rupee sign is rendered as "Rs."), so the
 * xref offsets are exact and no font embedding is required.
 */

export interface InvoicePdfInput {
  invoiceNumber: string;
  issuedAt: string;
  ownerName: string;
  ownerEmail: string;
  propertyName: string;
  planName: string;
  planDays: number;
  amountInr: number;
  paymentId?: string;
  orderId?: string;
  supportEmail?: string;
}

/** PDF string literal, escaped and reduced to printable WinAnsi. */
function pdfText(value: unknown): string {
  const cleaned = String(value ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/\r?\n/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\uffff]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return cleaned;
}

function money(amount: number): string {
  return `Rs. ${(Math.round((Number(amount) || 0) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Line {
  text: string;
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  grey?: boolean;
}

function contentStream(input: InvoicePdfInput): string {
  const lines: Line[] = [];
  /** Horizontal rules: y position and stroke width. */
  const rules: Array<{ y: number; width: number }> = [];
  const push = (text: string, x: number, y: number, size = 10, bold = false, grey = false) =>
    lines.push({ text, x, y, size, bold, grey });

  push('PGWalo', 50, 782, 22, true);
  push('TAX INVOICE', 470, 782, 12, true);
  push('pgwalo.com  ·  support@pgwalo.com', 50, 764, 9, false, true);
  rules.push({ y: 754, width: 0.8 });

  push('Invoice number', 50, 730, 9, false, true);
  push(input.invoiceNumber, 50, 716, 11, true);
  push('Invoice date', 250, 730, 9, false, true);
  push(dateLabel(input.issuedAt), 250, 716, 11, true);
  push('Amount paid', 430, 730, 9, false, true);
  push(money(input.amountInr), 430, 716, 11, true);

  push('Billed to', 50, 680, 9, false, true);
  push(input.ownerName || 'PGWalo Owner', 50, 666, 11, true);
  if (input.ownerEmail) push(input.ownerEmail, 50, 652, 10);

  push('Payment reference', 250, 680, 9, false, true);
  push(input.paymentId || input.orderId || '-', 250, 666, 10, true);

  rules.push({ y: 636, width: 0.8 });

  push('Description', 50, 616, 9, false, true);
  push('Amount', 470, 616, 9, false, true);

  push(`${input.planName} publishing plan`, 50, 594, 11, true);
  push(money(input.amountInr), 470, 594, 11, true);
  push(`Listing: ${input.propertyName}`, 50, 580, 9.5, false, true);
  push(`Validity: ${input.planDays} days from the date of payment`, 50, 566, 9.5, false, true);

  rules.push({ y: 546, width: 0.8 });
  push('Total paid', 380, 524, 11, true);
  push(money(input.amountInr), 470, 524, 12, true);
  rules.push({ y: 508, width: 0.8 });

  push('This is a computer-generated invoice and needs no signature.', 50, 486, 8.5, false, true);
  push('Service: online listing and PG management on pgwalo.com.', 50, 474, 8.5, false, true);
  push('PGWalo charges no brokerage or commission on rent.', 50, 462, 8.5, false, true);
  push(input.supportEmail || 'support@pgwalo.com', 50, 100, 9, false, true);

  const ops: string[] = [];
  for (const line of lines) {
    const font = line.bold ? '/F2' : '/F1';
    const grey = line.grey ? '0.42 0.45 0.5 rg' : '0.06 0.09 0.16 rg';
    ops.push(`BT ${grey} ${font} ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${pdfText(line.text)}) Tj ET`);
  }
  for (const rule of rules) {
    ops.push(`0.85 0.88 0.92 RG ${rule.width} w 50 ${rule.y} m 545 ${rule.y} l S`);
  }

  return ops.join('\n');
}

/** Serialize the invoice as a base64 PDF, ready for an email attachment. */
export function invoicePdfBase64(input: InvoicePdfInput): string {
  const content = contentStream(input);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // The document is ASCII-only by construction, so this is a byte-exact encode.
  return btoa(pdf);
}

export function invoiceFileName(invoiceNumber: string): string {
  const safe = String(invoiceNumber || 'invoice').replace(/[^A-Za-z0-9-]+/g, '-');
  return `${safe}.pdf`;
}
