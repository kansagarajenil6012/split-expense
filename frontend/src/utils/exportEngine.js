import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [139, 92, 246] }, // Primary purple theme
    styles: { fontSize: 10, cellPadding: 4 },
  });

  doc.save(`${filename}.pdf`);
};

export const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      return `"${String(val === null || val === undefined ? '' : val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
