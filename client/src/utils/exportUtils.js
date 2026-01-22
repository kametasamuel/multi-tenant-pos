import * as XLSX from 'xlsx';

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file without extension
 * @param {string} sheetName - Name of the Excel sheet
 * @param {Object} options - Optional configuration
 * @param {Array} options.columns - Column configuration [{key: 'field', header: 'Header'}]
 */
export const exportToExcel = (data, filename, sheetName = 'Sheet1', options = {}) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  let exportData = data;

  // If columns are specified, map data to only include those columns
  if (options.columns && options.columns.length > 0) {
    exportData = data.map(row => {
      const newRow = {};
      options.columns.forEach(col => {
        const value = col.key.split('.').reduce((obj, key) => obj?.[key], row);
        newRow[col.header] = col.format ? col.format(value, row) : value;
      });
      return newRow;
    });
  }

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-size columns
  const colWidths = {};
  exportData.forEach(row => {
    Object.keys(row).forEach(key => {
      const value = String(row[key] || '');
      const currentWidth = colWidths[key] || key.length;
      colWidths[key] = Math.max(currentWidth, value.length);
    });
  });

  worksheet['!cols'] = Object.keys(colWidths).map(key => ({
    wch: Math.min(colWidths[key] + 2, 50)
  }));

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${date}.xlsx`;

  // Download file
  XLSX.writeFile(workbook, fullFilename);
};

/**
 * Format currency for export
 */
export const formatCurrencyForExport = (amount, currencySymbol = '$') => {
  return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Format date for export
 */
export const formatDateForExport = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString();
};

// Pre-configured export functions for common data types

export const exportSales = (sales, currencySymbol = '$') => {
  const columns = [
    { key: 'transactionNumber', header: 'Transaction #' },
    { key: 'createdAt', header: 'Date', format: formatDateForExport },
    { key: 'cashier.fullName', header: 'Cashier' },
    { key: 'branch.name', header: 'Branch' },
    { key: 'paymentMethod', header: 'Payment Method' },
    { key: 'paymentStatus', header: 'Status' },
    { key: 'totalAmount', header: 'Subtotal', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'discountAmount', header: 'Discount', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'finalAmount', header: 'Total', format: (v) => formatCurrencyForExport(v, currencySymbol) }
  ];

  exportToExcel(sales, 'sales_report', 'Sales', { columns });
};

export const exportInventory = (products, currencySymbol = '$') => {
  const columns = [
    { key: 'name', header: 'Product Name' },
    { key: 'sku', header: 'SKU' },
    { key: 'category', header: 'Category' },
    { key: 'stockQuantity', header: 'Stock Quantity' },
    { key: 'lowStockThreshold', header: 'Low Stock Threshold' },
    { key: 'sellingPrice', header: 'Selling Price', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'costPrice', header: 'Cost Price', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'expiryDate', header: 'Expiry Date', format: (v) => v ? new Date(v).toLocaleDateString() : 'N/A' },
    { key: 'branch.name', header: 'Branch' },
    { key: 'isActive', header: 'Active', format: (v) => v ? 'Yes' : 'No' }
  ];

  exportToExcel(products, 'inventory_report', 'Inventory', { columns });
};

export const exportStaff = (staff) => {
  const columns = [
    { key: 'fullName', header: 'Full Name' },
    { key: 'username', header: 'Username' },
    { key: 'role', header: 'Role' },
    { key: 'branch.name', header: 'Branch' },
    { key: 'isActive', header: 'Status', format: (v) => v ? 'Active' : 'Inactive' },
    { key: 'createdAt', header: 'Joined Date', format: formatDateForExport }
  ];

  exportToExcel(staff, 'staff_report', 'Staff', { columns });
};

export const exportCustomers = (customers, currencySymbol = '$') => {
  const columns = [
    { key: 'name', header: 'Customer Name' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'totalPurchases', header: 'Total Purchases', format: (v) => v || 0 },
    { key: 'totalSpent', header: 'Total Spent', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'loyaltyPoints', header: 'Loyalty Points' },
    { key: 'createdAt', header: 'Joined Date', format: formatDateForExport }
  ];

  exportToExcel(customers, 'customers_report', 'Customers', { columns });
};

export const exportExpenses = (expenses, currencySymbol = '$') => {
  const columns = [
    { key: 'description', header: 'Description' },
    { key: 'category', header: 'Category' },
    { key: 'amount', header: 'Amount', format: (v) => formatCurrencyForExport(v, currencySymbol) },
    { key: 'branch.name', header: 'Branch' },
    { key: 'recorder.fullName', header: 'Recorded By' },
    { key: 'createdAt', header: 'Date', format: formatDateForExport }
  ];

  exportToExcel(expenses, 'expenses_report', 'Expenses', { columns });
};
