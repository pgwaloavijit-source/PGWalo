import { jsPDF } from 'jspdf';
import type { Invoice, PaymentReceipt } from '../types';

const money = (value: number) => `INR ${value.toLocaleString('en-IN')}`;

const addHeader = (pdf: jsPDF, title: string, subtitle: string) => {
  pdf.setFillColor(37, 99, 235);
  pdf.rect(0, 0, 210, 30, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PGWalo', 16, 13);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Premium living, simplified', 16, 21);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 16, 46);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(subtitle, 16, 53);
};

const addRow = (pdf: jsPDF, label: string, value: string, y: number, bold = false) => {
  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label, 16, y);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.text(value, 194, y, { align: 'right' });
};

const addFooter = (pdf: jsPDF) => {
  pdf.setDrawColor(226, 232, 240);
  pdf.line(16, 276, 194, 276);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Generated securely by PGWalo', 16, 284);
  pdf.text(new Date().toLocaleDateString('en-IN'), 194, 284, { align: 'right' });
};

export const downloadInvoicePdf = (invoice: Invoice) => {
  const pdf = new jsPDF();
  addHeader(pdf, 'Tax Invoice / Rent Statement', `${invoice.month} • Invoice ${invoice.invoiceNumber}`);

  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.residentName, 16, 70);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${invoice.propertyName} • Room ${invoice.roomNumber}`, 16, 77);
  pdf.text(`Billing period: ${invoice.billingCycleStart} to ${invoice.billingCycleEnd}`, 16, 84);
  pdf.text(`Due date: ${invoice.dueDate}`, 16, 91);

  pdf.setDrawColor(226, 232, 240);
  pdf.line(16, 101, 194, 101);
  let y = 114;
  invoice.lineItems.forEach((item) => {
    addRow(pdf, item.description, money(item.amount), y);
    y += 9;
  });
  addRow(pdf, 'Subtotal', money(invoice.subtotal), y + 4, true);
  addRow(pdf, 'Previous dues', money(invoice.previousDuesApplied), y + 13);
  addRow(pdf, 'Advance deducted', `- ${money(invoice.advanceDeducted)}`, y + 22);
  addRow(pdf, 'Total due', money(invoice.totalDue), y + 35, true);
  addRow(pdf, 'Amount paid', money(invoice.amountPaid), y + 44);
  addRow(pdf, 'Outstanding balance', money(invoice.outstandingBalance), y + 53, true);
  addFooter(pdf);
  pdf.save(`${invoice.invoiceNumber}-PGWalo.pdf`);
};

export const downloadReceiptPdf = (receipt: PaymentReceipt) => {
  const pdf = new jsPDF();
  addHeader(pdf, 'Payment Receipt', `Transaction ${receipt.transactionId}`);
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text(receipt.residentName, 16, 70);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${receipt.propertyName} • Room ${receipt.roomNumber}`, 16, 77);
  pdf.text(`Billing month: ${receipt.month}`, 16, 84);
  pdf.text(`Paid on: ${receipt.paidAt}`, 16, 91);
  pdf.line(16, 101, 194, 101);
  addRow(pdf, 'Payment method', receipt.paymentMethod, 116);
  addRow(pdf, 'Transaction ID', receipt.transactionId, 126);
  addRow(pdf, 'Payment status', receipt.status, 136);
  addRow(pdf, 'Amount received', money(receipt.amount), 155, true);
  addFooter(pdf);
  pdf.save(`PGWalo-receipt-${receipt.transactionId}.pdf`);
};

export const downloadFinancialStatementPdf = (invoices: Invoice[]) => {
  const pdf = new jsPDF();
  addHeader(pdf, 'Financial Statement', `${invoices.length} invoices • PGWalo billing ledger`);
  let y = 70;
  invoices.slice(0, 12).forEach((invoice) => {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(invoice.invoiceNumber, 16, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${invoice.residentName} • ${invoice.month}`, 55, y);
    pdf.text(invoice.status, 140, y);
    pdf.setTextColor(15, 23, 42);
    pdf.text(money(invoice.totalDue), 194, y, { align: 'right' });
    y += 10;
  });
  addFooter(pdf);
  pdf.save('PGWalo-financial-statement.pdf');
};
