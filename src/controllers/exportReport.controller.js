const ExcelJS = require('exceljs');
const pool = require('../config/database');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const pad = (n) => String(n).padStart(2, '0');

// ============================================================
// PERIOD: turns ?period=month|year|range into a start/end date
// (start is included, end is NOT included)
// ============================================================

const resolvePeriod = (query) => {
  const now = new Date();
  const period = query.period || 'month';
  const year = parseInt(query.year, 10) || now.getFullYear();

  if (year < 2000 || year > 2100) {
    return { error: 'Invalid year' };
  }

  // Whole year
  if (period === 'year') {
    return {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
      label: `${year} (full year)`,
      slug: `${year}_full-year`
    };
  }

  // Custom date range (both dates included)
  if (period === 'range') {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const from = query.from || '';
    const to = query.to || '';

    if (!re.test(from) || !re.test(to)) {
      return { error: 'Choose both a start date and an end date' };
    }
    if (from > to) {
      return { error: 'The start date must be before the end date' };
    }

    const endDate = new Date(to + 'T00:00:00Z');
    if (isNaN(endDate.getTime())) {
      return { error: 'Invalid date' };
    }
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    return {
      start: from,
      end: endDate.toISOString().slice(0, 10),
      label: `${from} to ${to}`,
      slug: `${from}_to_${to}`
    };
  }

  // A single month (default: the current month)
  const month = parseInt(query.month, 10) || now.getMonth() + 1;
  if (month < 1 || month > 12) {
    return { error: 'Invalid month' };
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${nextYear}-${pad(nextMonth)}-01`,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    slug: `${year}-${pad(month)}`
  };
};

// ============================================================
// WHAT CAN BE EXPORTED
// Every query takes $1 = period start, $2 = period end.
// Column types: text | date | datetime | qty | money | link
// sum: true adds a total at the bottom of the sheet.
// ============================================================

const DATASETS = {
  'fuel-requests': {
    sheet: 'Fuel Requests',
    fileLabel: 'Fuel_Requests',
    sql: `
      SELECT
        f.id,
        f.created_at,
        c.company_name,
        f.fuel_type,
        f.quantity,
        f.unit,
        f.priority,
        f.status,
        f.delivery_address,
        f.delivery_city,
        f.preferred_delivery_date,
        f.preferred_delivery_time,
        f.special_instructions
      FROM fuel_requests f
      LEFT JOIN customers c ON f.customer_id = c.id
      WHERE f.created_at >= $1::timestamp AND f.created_at < $2::timestamp
      ORDER BY f.created_at DESC
    `,
    columns: [
      { header: 'Request ID', key: 'id', width: 12 },
      { header: 'Requested On', key: 'created_at', width: 20, type: 'datetime' },
      { header: 'Customer', key: 'company_name', width: 28 },
      { header: 'Fuel Type', key: 'fuel_type', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 14, type: 'qty', sum: true },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Delivery Address', key: 'delivery_address', width: 34 },
      { header: 'City', key: 'delivery_city', width: 16 },
      { header: 'Preferred Date', key: 'preferred_delivery_date', width: 16, type: 'date' },
      { header: 'Preferred Time', key: 'preferred_delivery_time', width: 14 },
      { header: 'Special Instructions', key: 'special_instructions', width: 36 }
    ]
  },

  quotations: {
    sheet: 'Quotations',
    fileLabel: 'Quotations',
    sql: `
      SELECT
        q.quotation_number,
        q.created_at,
        COALESCE(q.sent_at, q.sent_date) AS sent_at,
        q.expires_at,
        c.company_name,
        c.contact_person_name,
        q.fuel_type,
        q.quantity,
        q.unit,
        q.unit_price,
        q.total_amount,
        q.status,
        q.accepted_date,
        q.delivery_terms,
        q.payment_terms,
        q.notes
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.created_at >= $1::timestamp AND q.created_at < $2::timestamp
      ORDER BY q.created_at DESC
    `,
    columns: [
      { header: 'Quotation No.', key: 'quotation_number', width: 20 },
      { header: 'Created', key: 'created_at', width: 20, type: 'datetime' },
      { header: 'Sent', key: 'sent_at', width: 20, type: 'datetime' },
      { header: 'Expires', key: 'expires_at', width: 20, type: 'datetime' },
      { header: 'Customer', key: 'company_name', width: 28 },
      { header: 'Contact Person', key: 'contact_person_name', width: 22 },
      { header: 'Fuel Type', key: 'fuel_type', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 14, type: 'qty', sum: true },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Unit Price', key: 'unit_price', width: 12, type: 'money' },
      { header: 'Total', key: 'total_amount', width: 16, type: 'money', sum: true },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Accepted On', key: 'accepted_date', width: 20, type: 'datetime' },
      { header: 'Delivery Terms', key: 'delivery_terms', width: 30 },
      { header: 'Payment Terms', key: 'payment_terms', width: 30 },
      { header: 'Notes', key: 'notes', width: 30 }
    ]
  },

  orders: {
    sheet: 'Orders',
    fileLabel: 'Orders',
    sql: `
      SELECT
        o.order_number,
        q.quotation_number,
        o.created_at,
        c.company_name,
        c.contact_person_name,
        c.contact_person_phone,
        c.contact_person_email,
        o.fuel_type,
        o.quantity,
        o.unit,
        o.unit_price,
        o.total_amount,
        o.status,
        o.payment_status,
        o.payment_verified_at,
        o.purchase_order_number,
        o.delivery_address,
        o.delivery_city,
        o.preferred_delivery_date,
        o.completed_at,
        o.invoice_filename
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN quotations q ON o.quotation_id = q.id
      WHERE o.created_at >= $1::timestamp AND o.created_at < $2::timestamp
      ORDER BY o.created_at DESC
    `,
    columns: [
      { header: 'Order No.', key: 'order_number', width: 22 },
      { header: 'Quotation No.', key: 'quotation_number', width: 20 },
      { header: 'Ordered On', key: 'created_at', width: 20, type: 'datetime' },
      { header: 'Customer', key: 'company_name', width: 28 },
      { header: 'Contact Person', key: 'contact_person_name', width: 22 },
      { header: 'Phone', key: 'contact_person_phone', width: 18 },
      { header: 'Email', key: 'contact_person_email', width: 28 },
      { header: 'Fuel Type', key: 'fuel_type', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 14, type: 'qty', sum: true },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Unit Price', key: 'unit_price', width: 12, type: 'money' },
      { header: 'Total', key: 'total_amount', width: 16, type: 'money', sum: true },
      { header: 'Order Status', key: 'status', width: 18 },
      { header: 'Payment Status', key: 'payment_status', width: 16 },
      { header: 'Payment Confirmed On', key: 'payment_verified_at', width: 22, type: 'datetime' },
      { header: 'PO Number', key: 'purchase_order_number', width: 18 },
      { header: 'Delivery Address', key: 'delivery_address', width: 34 },
      { header: 'City', key: 'delivery_city', width: 16 },
      { header: 'Preferred Delivery', key: 'preferred_delivery_date', width: 18, type: 'date' },
      { header: 'Completed On', key: 'completed_at', width: 20, type: 'datetime' },
      { header: 'Invoice File', key: 'invoice_filename', width: 28 }
    ]
  },

  // There is no separate invoices table: an invoice is the file uploaded on an order.
  // So invoices are filtered by the day the invoice was uploaded.
  invoices: {
    sheet: 'Invoices',
    fileLabel: 'Invoices',
    sql: `
      SELECT
        o.order_number,
        o.invoice_filename,
        o.invoice_path AS invoice_link,
        o.invoice_uploaded_at,
        CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by,
        c.company_name,
        o.fuel_type,
        o.quantity,
        o.unit,
        o.total_amount,
        o.payment_status
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.invoice_uploaded_by = u.id
      WHERE o.invoice_path IS NOT NULL
        AND o.invoice_uploaded_at >= $1::timestamp
        AND o.invoice_uploaded_at < $2::timestamp
      ORDER BY o.invoice_uploaded_at DESC
    `,
    columns: [
      { header: 'Order No.', key: 'order_number', width: 22 },
      { header: 'Invoice File', key: 'invoice_filename', width: 30 },
      { header: 'Invoice Link', key: 'invoice_link', width: 16, type: 'link' },
      { header: 'Uploaded On', key: 'invoice_uploaded_at', width: 20, type: 'datetime' },
      { header: 'Uploaded By', key: 'uploaded_by', width: 22 },
      { header: 'Customer', key: 'company_name', width: 28 },
      { header: 'Fuel Type', key: 'fuel_type', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 14, type: 'qty', sum: true },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Total', key: 'total_amount', width: 16, type: 'money', sum: true },
      { header: 'Payment Status', key: 'payment_status', width: 16 }
    ]
  }
};

// ============================================================
// HELPERS
// ============================================================

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
};

// Cleans a database row for Excel (numbers as numbers, links as links)
const prepareRow = (row, columns) => {
  const out = {};
  columns.forEach((col) => {
    const value = row[col.key];
    if (col.type === 'qty' || col.type === 'money') {
      out[col.key] = toNumber(value);
    } else if (col.type === 'link') {
      out[col.key] = value ? { text: 'Open invoice', hyperlink: value } : null;
    } else {
      out[col.key] = value === undefined ? null : value;
    }
  });
  return out;
};

const formatForCsv = (value, col) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const d = value;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (col.type === 'date') return date;
    return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(value);
};

const csvEscape = (text) => {
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
};

const buildCsv = (dataset, rows) => {
  const lines = [];
  lines.push(dataset.columns.map((c) => csvEscape(c.header)).join(','));
  rows.forEach((row) => {
    lines.push(
      dataset.columns
        .map((col) => csvEscape(formatForCsv(row[col.key], col)))
        .join(',')
    );
  });
  // BOM so Excel opens accents and symbols correctly
  return '\uFEFF' + lines.join('\r\n');
};

const NUMBER_FORMATS = {
  qty: '#,##0',
  money: '"$"#,##0.00',
  date: 'dd mmm yyyy',
  datetime: 'dd mmm yyyy hh:mm'
};

const styleHeader = (sheet) => {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B1B33' } };
  });
};

// One worksheet for one dataset
const addDatasetSheet = (workbook, dataset, rawRows) => {
  const sheet = workbook.addWorksheet(dataset.sheet);
  const rows = rawRows.map((row) => prepareRow(row, dataset.columns));

  sheet.columns = dataset.columns.map((col) => {
    const column = { header: col.header, key: col.key, width: col.width || 16 };
    if (NUMBER_FORMATS[col.type]) {
      column.style = { numFmt: NUMBER_FORMATS[col.type] };
    }
    return column;
  });

  rows.forEach((row) => sheet.addRow(row));

  styleHeader(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: dataset.columns.length }
  };

  // Totals, one empty row below the data
  const sumColumns = dataset.columns.filter((col) => col.sum);
  if (rows.length > 0 && sumColumns.length > 0) {
    const totalRowNumber = rows.length + 3;
    const totalRow = sheet.getRow(totalRowNumber);
    totalRow.getCell(1).value = 'Total';
    totalRow.font = { bold: true };

    sumColumns.forEach((col) => {
      const letter = sheet.getColumn(col.key).letter;
      const result = rows.reduce((sum, row) => sum + (row[col.key] || 0), 0);
      const cell = totalRow.getCell(col.key);
      cell.value = {
        formula: `SUBTOTAL(109,${letter}2:${letter}${rows.length + 1})`,
        result
      };
      cell.numFmt = NUMBER_FORMATS[col.type];
    });
  }

  return rows;
};

// Summary sheet used when exporting everything
const addSummarySheet = (workbook, period, keys, rowsByKey) => {
  const sheet = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FFCC0000' } } });

  sheet.getCell('A1').value = 'GlowBulk report';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A2').value = 'Period';
  sheet.getCell('B2').value = period.label;
  sheet.getCell('A3').value = 'Generated';
  sheet.getCell('B3').value = new Date();
  sheet.getCell('B3').numFmt = 'dd mmm yyyy hh:mm';
  sheet.getCell('A2').font = { bold: true };
  sheet.getCell('A3').font = { bold: true };

  const headerRow = sheet.getRow(5);
  headerRow.values = ['Sheet', 'Records', 'Total quantity', 'Total value'];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B1B33' } };
  });

  keys.forEach((key, index) => {
    const dataset = DATASETS[key];
    const rows = rowsByKey[key];
    const hasValue = dataset.columns.some((c) => c.key === 'total_amount');

    const quantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const value = hasValue ? rows.reduce((sum, r) => sum + (r.total_amount || 0), 0) : null;

    const row = sheet.getRow(6 + index);
    row.getCell(1).value = dataset.sheet;
    row.getCell(2).value = rows.length;
    row.getCell(3).value = quantity;
    row.getCell(3).numFmt = NUMBER_FORMATS.qty;
    if (value !== null) {
      row.getCell(4).value = value;
      row.getCell(4).numFmt = NUMBER_FORMATS.money;
    } else {
      row.getCell(4).value = '—';
      row.getCell(4).alignment = { horizontal: 'right' };
    }
  });

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;
};

// ============================================================
// GET /api/export/report
//   ?type=all | quotations | orders | invoices | fuel-requests
//   &period=month | year | range
//   &month=10 &year=2026            (month)
//   &year=2026                      (year)
//   &from=2026-01-01 &to=2026-03-31 (range)
//   &format=xlsx | csv              (csv only for a single type)
// ============================================================

const exportReport = async (req, res) => {
  try {
    const type = String(req.query.type || 'all').toLowerCase();
    const validTypes = ['all', ...Object.keys(DATASETS)];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Choose what to export: ' + validTypes.join(', ')
      });
    }

    const period = resolvePeriod(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, message: period.error });
    }

    const keys = type === 'all' ? Object.keys(DATASETS) : [type];
    const wantsCsv = type !== 'all' && String(req.query.format).toLowerCase() === 'csv';

    // Run every query for this period
    const results = await Promise.all(
      keys.map((key) => pool.query(DATASETS[key].sql, [period.start, period.end]))
    );

    const rowsByKey = {};
    keys.forEach((key, index) => {
      rowsByKey[key] = results[index].rows;
    });

    const fileLabel = type === 'all' ? 'Everything' : DATASETS[type].fileLabel;
    const baseName = `GlowBulk_${fileLabel}_${period.slug}`;

    // ---------- CSV (single type only) ----------
    if (wantsCsv) {
      const csv = buildCsv(DATASETS[type], rowsByKey[type]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
      return res.send(csv);
    }

    // ---------- Excel ----------
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GlowBulk';
    workbook.created = new Date();

    if (type === 'all') {
      // Summary goes first, so it is the first tab when the file opens
      const cleanRowsByKey = {};
      keys.forEach((key) => {
        cleanRowsByKey[key] = rowsByKey[key].map((row) => prepareRow(row, DATASETS[key].columns));
      });
      addSummarySheet(workbook, period, keys, cleanRowsByKey);
    }

    keys.forEach((key) => {
      addDatasetSheet(workbook, DATASETS[key], rowsByKey[key]);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error exporting report',
        error: error.message
      });
    }
  }
};

module.exports = { exportReport };