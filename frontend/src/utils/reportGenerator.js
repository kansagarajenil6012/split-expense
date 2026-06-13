import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatCurrency } from './formatters.js';

/**
 * Generates a comprehensive PDF Report for a Group
 */
export const generateGroupPDFReport = ({ group, members, balances, expenses }) => {
  const doc = new jsPDF();
  const themeColor = [139, 92, 246]; // Purple #8B5CF6
  const currency = group?.currency || 'INR';
  
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  // Company Logo / App Name
  doc.setFontSize(24);
  doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('SPLIT EXPENSE', 14, 25);
  
  // Document Type
  doc.setFontSize(16);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('STATEMENT OF ACCOUNT', 196, 25, { align: 'right' });
  
  // Horizontal Divider
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);
  
  // Group Details (Bill To)
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Account Name:', 14, 40);
  doc.text('Statement Date:', 14, 46);
  doc.text('Total Members:', 14, 52);
  
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(group?.name || 'Group Account', 45, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(new Date().toISOString()), 45, 46);
  doc.text(`${members.length}`, 45, 52);

  // Summary Metrics (Top Right)
  doc.setTextColor(120, 120, 120);
  doc.text('Total Expenses Count:', 120, 40);
  doc.text('Total Account Spend:', 120, 46);
  
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`${expenses.length}`, 165, 40);
  doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.text(formatCurrency(totalSpent, currency), 165, 46);
  
  doc.line(14, 60, 196, 60);

  let currentY = 70;

  // Balances Section (Ledger Summary)
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Account Balances Summary', 14, currentY);
  currentY += 5;

  const balanceRows = balances.map(b => {
    const bal = parseFloat(b.balance);
    const status = bal === 0 ? 'Settled Up' : bal > 0 ? 'Credit (+)' : 'Debit (-)';
    return [
      b.full_name,
      status,
      formatCurrency(Math.abs(bal), currency)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Member Name', 'Account Status', 'Net Balance']],
    body: balanceRows,
    theme: 'plain',
    headStyles: { fillColor: [240, 240, 245], textColor: [80, 80, 80], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4, font: 'helvetica', lineColor: [220, 220, 220], lineWidth: 0.1 },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'Debit (-)') data.cell.styles.textColor = [220, 38, 38]; // Red
        else if (data.cell.raw === 'Credit (+)') data.cell.styles.textColor = [5, 150, 105]; // Green
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // Expenses Section (Transaction History)
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction History (Expenses)', 14, currentY);
  currentY += 5;

  const expenseRows = expenses.map(e => [
    formatDate(e.expense_date),
    e.title,
    e.category_name || 'General',
    e.paid_by_name || 'Unknown',
    formatCurrency(parseFloat(e.amount), currency)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Category', 'Paid By', 'Amount']],
    body: expenseRows,
    theme: 'grid',
    headStyles: { fillColor: themeColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  doc.save(`${group?.name || 'Group'}_Report.pdf`);
};

/**
 * Generates a comprehensive Excel Report for a Group
 */
export const generateGroupExcelReport = ({ group, members, balances, expenses }) => {
  const wb = xlsx.utils.book_new();
  const currency = group?.currency || 'INR';
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // SHEET 1: SUMMARY & BALANCES
  const summaryData = [
    ['Group Report', group?.name || 'Group'],
    ['Generated On', formatDate(new Date().toISOString())],
    ['Total Members', members.length],
    ['Total Expenses', expenses.length],
    ['Total Spent', formatCurrency(totalSpent, currency)],
    [],
    ['MEMBER BALANCES'],
    ['Member Name', 'Status', 'Net Balance']
  ];

  balances.forEach(b => {
    const bal = parseFloat(b.balance);
    const status = bal === 0 ? 'Settled Up' : bal > 0 ? 'Gets Back' : 'Owes';
    summaryData.push([b.full_name, status, Math.abs(bal)]);
  });

  const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
  // Auto-size columns for Summary sheet
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }];
  xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary & Balances');

  // SHEET 2: EXPENSES
  const expenseHeaders = ['Date', 'Title', 'Category', 'Paid By', 'Split Type', 'Amount'];
  const expenseData = [expenseHeaders];

  expenses.forEach(e => {
    expenseData.push([
      formatDate(e.expense_date),
      e.title,
      e.category_name || 'Uncategorized',
      e.paid_by_name || 'Unknown',
      e.split_type?.toUpperCase() || 'EQUAL',
      parseFloat(e.amount)
    ]);
  });

  const wsExpenses = xlsx.utils.aoa_to_sheet(expenseData);
  // Auto-size columns for Expenses sheet
  wsExpenses['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  xlsx.utils.book_append_sheet(wb, wsExpenses, 'All Expenses');

  // Export
  xlsx.writeFile(wb, `${group?.name || 'Group'}_Report.xlsx`);
};
