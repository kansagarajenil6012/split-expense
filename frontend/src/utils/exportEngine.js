import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate } from './formatters.js';

export const exportToExcel = (data, filename, sheetName = 'Sheet 1') => {
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName);
  xlsx.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = (headers, rows, filename, title = 'Report') => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.autoTable({
    startY: 30,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [139, 92, 246] }, // Primary purple theme
    styles: { fontSize: 10, cellPadding: 4 },
  });

  doc.save(`${filename}.pdf`);
};

// Data Formatter Helpers
export const generateExpensesExportData = (expenses) => {
  return expenses.map(e => ({
    'Date': formatDate(e.expense_date),
    'Title': e.title,
    'Category': e.category_name || 'Uncategorized',
    'Paid By': e.paid_by_name,
    'Split Type': e.split_type?.toUpperCase(),
    'Total Amount': parseFloat(e.amount),
  }));
};

export const generateBalancesExportData = (balances) => {
  return balances.map(b => {
    const bal = parseFloat(b.balance);
    return {
      'Member Name': b.full_name,
      'Status': bal === 0 ? 'Settled Up' : bal > 0 ? 'Gets Back' : 'Owes',
      'Net Balance': Math.abs(bal),
    };
  });
};
