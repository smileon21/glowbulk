const pool = require('../config/database');
const ExcelJS = require('exceljs');

// Export customers to Excel
const exportCustomers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.role,
        u.is_active,
        u.created_at,
        c.company_name,
        c.company_registration,
        c.billing_address,
        c.billing_city,
        c.billing_country,
        c.delivery_address,
        c.delivery_city,
        c.delivery_country,
        c.industry,
        c.contact_person_name,
        c.contact_person_email,
        c.contact_person_phone,
        c.credit_limit,
        c.status as customer_status
      FROM users u
      LEFT JOIN customers c ON u.id = c.user_id
      WHERE u.role = 'customer'
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query);
    const customers = result.rows;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GlowBulk';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Customers', {
      properties: { tabColor: { argb: 'CC0000' } },
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    const titleRow = worksheet.addRow(['CUSTOMER LIST']);
    titleRow.font = { 
      name: 'Arial', 
      size: 16, 
      bold: true,
      color: { argb: 'FFCC0000' }
    };
    titleRow.height = 30;
    worksheet.mergeCells(`A${titleRow.number}:U${titleRow.number}`);
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    const dateRow = worksheet.addRow([`Generated on ${new Date().toLocaleDateString()}`]);
    dateRow.font = { name: 'Arial', size: 10, color: { argb: 'FF666666' } };
    worksheet.mergeCells(`A${dateRow.number}:U${dateRow.number}`);
    dateRow.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'First Name', key: 'first_name', width: 15 },
      { header: 'Last Name', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Company Name', key: 'company_name', width: 30 },
      { header: 'Company Registration', key: 'company_registration', width: 20 },
      { header: 'Industry', key: 'industry', width: 20 },
      { header: 'Contact Person', key: 'contact_person_name', width: 20 },
      { header: 'Contact Email', key: 'contact_person_email', width: 30 },
      { header: 'Contact Phone', key: 'contact_person_phone', width: 15 },
      { header: 'Billing Address', key: 'billing_address', width: 30 },
      { header: 'Billing City', key: 'billing_city', width: 15 },
      { header: 'Billing Country', key: 'billing_country', width: 15 },
      { header: 'Delivery Address', key: 'delivery_address', width: 30 },
      { header: 'Delivery City', key: 'delivery_city', width: 15 },
      { header: 'Delivery Country', key: 'delivery_country', width: 15 },
      { header: 'Credit Limit', key: 'credit_limit', width: 15 },
      { header: 'Status', key: 'customer_status', width: 12 },
      { header: 'User Status', key: 'is_active', width: 12 },
      { header: 'Joined Date', key: 'created_at', width: 20 }
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.font = { 
      name: 'Arial', 
      size: 11, 
      bold: true, 
      color: { argb: 'FFFFFFFF' } 
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'CC0000' }
    };
    headerRow.alignment = { 
      horizontal: 'center', 
      vertical: 'middle' 
    };
    headerRow.height = 25;

    customers.forEach((customer, index) => {
      const row = worksheet.addRow({
        id: customer.id,
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company_name: customer.company_name || '',
        company_registration: customer.company_registration || '',
        industry: customer.industry || '',
        contact_person_name: customer.contact_person_name || '',
        contact_person_email: customer.contact_person_email || '',
        contact_person_phone: customer.contact_person_phone || '',
        billing_address: customer.billing_address || '',
        billing_city: customer.billing_city || '',
        billing_country: customer.billing_country || '',
        delivery_address: customer.delivery_address || '',
        delivery_city: customer.delivery_city || '',
        delivery_country: customer.delivery_country || '',
        credit_limit: customer.credit_limit || 0,
        customer_status: customer.customer_status || 'active',
        is_active: customer.is_active ? 'Active' : 'Inactive',
        created_at: customer.created_at ? new Date(customer.created_at).toLocaleDateString() : ''
      });

      row.eachCell((cell) => {
        cell.alignment = { 
          vertical: 'middle',
          horizontal: 'left'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          left: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          bottom: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          right: { style: 'thin', color: { argb: 'FFE3DFD2' } }
        };
      });

      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        });
      }
    });

    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      `Total Customers: ${customers.length}`
    ]);
    summaryRow.font = { bold: true, size: 12 };
    worksheet.mergeCells(`A${summaryRow.number}:U${summaryRow.number}`);
    summaryRow.alignment = { horizontal: 'left', vertical: 'middle' };

    const filename = `GlowBulk_Customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader(
      'Content-Type', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=${filename}`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting customers',
      error: error.message
    });
  }
};

// Export monthly customer report
const exportMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.created_at,
        c.company_name,
        c.industry,
        c.contact_person_name,
        c.contact_person_email,
        c.contact_person_phone
      FROM users u
      LEFT JOIN customers c ON u.id = c.user_id
      WHERE u.role = 'customer' 
        AND EXTRACT(MONTH FROM u.created_at) = $1
        AND EXTRACT(YEAR FROM u.created_at) = $2
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query, [selectedMonth, selectedYear]);
    const customers = result.rows;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GlowBulk';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet(`Monthly Report - ${selectedMonth}/${selectedYear}`);

    const titleRow = worksheet.addRow([`MONTHLY CUSTOMER REPORT`]);
    titleRow.font = { 
      name: 'Arial', 
      size: 18, 
      bold: true,
      color: { argb: 'FFCC0000' }
    };
    titleRow.height = 35;
    worksheet.mergeCells(`A${titleRow.number}:K${titleRow.number}`);
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    const subtitleRow = worksheet.addRow([
      `Report Period: ${selectedMonth}/${selectedYear}`
    ]);
    subtitleRow.font = { 
      name: 'Arial', 
      size: 12, 
      bold: true 
    };
    subtitleRow.height = 25;
    worksheet.mergeCells(`A${subtitleRow.number}:K${subtitleRow.number}`);
    subtitleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'First Name', key: 'first_name', width: 15 },
      { header: 'Last Name', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Company', key: 'company_name', width: 30 },
      { header: 'Industry', key: 'industry', width: 20 },
      { header: 'Contact Person', key: 'contact_person_name', width: 20 },
      { header: 'Contact Email', key: 'contact_person_email', width: 30 },
      { header: 'Contact Phone', key: 'contact_person_phone', width: 15 },
      { header: 'Registered Date', key: 'created_at', width: 20 }
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.font = { 
      name: 'Arial', 
      size: 11, 
      bold: true, 
      color: { argb: 'FFFFFFFF' } 
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCC0000' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    customers.forEach((customer, index) => {
      const row = worksheet.addRow({
        id: customer.id,
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company_name: customer.company_name || '',
        industry: customer.industry || '',
        contact_person_name: customer.contact_person_name || '',
        contact_person_email: customer.contact_person_email || '',
        contact_person_phone: customer.contact_person_phone || '',
        created_at: customer.created_at ? new Date(customer.created_at).toLocaleDateString() : ''
      });

      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          left: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          bottom: { style: 'thin', color: { argb: 'FFE3DFD2' } },
          right: { style: 'thin', color: { argb: 'FFE3DFD2' } }
        };
      });

      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        });
      }
    });

    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      `Total Customers: ${customers.length}`
    ]);
    summaryRow.font = { bold: true, size: 12 };
    worksheet.mergeCells(`A${summaryRow.number}:K${summaryRow.number}`);

    const filename = `GlowBulk_Monthly_Report_${selectedYear}_${selectedMonth}.xlsx`;
    
    res.setHeader(
      'Content-Type', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=${filename}`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting monthly report',
      error: error.message
    });
  }
};

// Export monthly orders report - SIMPLIFIED VERSION
const exportMonthlyOrdersReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();

    const query = `
      SELECT 
        o.order_number,
        o.fuel_type,
        o.quantity,
        o.unit,
        o.unit_price,
        o.total_amount,
        o.tax_amount,
        o.grand_total,
        o.status,
        o.payment_status,
        o.created_at,
        o.completed_at,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        c.company_name,
        c.company_registration,
        c.contact_person_name,
        c.contact_person_email,
        c.contact_person_phone,
        o.delivery_address,
        o.delivery_city,
        o.delivery_country,
        o.preferred_delivery_date,
        o.purchase_order_number
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE EXTRACT(MONTH FROM o.created_at) = $1
        AND EXTRACT(YEAR FROM o.created_at) = $2
      ORDER BY o.created_at DESC
    `;
    
    const result = await pool.query(query, [selectedMonth, selectedYear]);
    const orders = result.rows;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GlowBulk';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Orders Report');

    // Title
    worksheet.addRow(['MONTHLY CUSTOMER ORDERS REPORT']);
    worksheet.mergeCells(`A1:P1`);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFCC0000' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Subtitle
    worksheet.addRow([`Report Period: ${selectedMonth}/${selectedYear}`]);
    worksheet.mergeCells(`A2:P2`);
    const subRow = worksheet.getRow(2);
    subRow.font = { name: 'Arial', size: 12, bold: true };
    subRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Empty row
    worksheet.addRow([]);

    // Summary
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
    worksheet.addRow([`Total Orders: ${totalOrders}`, `Total Revenue: $${totalRevenue.toFixed(2)}`]);
    worksheet.mergeCells(`A4:B4`);
    const sumRow = worksheet.getRow(4);
    sumRow.font = { name: 'Arial', size: 11, bold: true };
    sumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

    // Empty row
    worksheet.addRow([]);

    // =============================================
    // HEADERS - Add as a simple row
    // =============================================
    const headers = [
      'Order Number', 'Customer', 'Company', 'Fuel Type', 'Quantity', 'Unit',
      'Unit Price', 'Subtotal', 'Tax', 'Grand Total', 'Status', 'Payment',
      'PO Number', 'Delivery Address', 'Order Date', 'Completed'
    ];
    
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Set column widths
    worksheet.getColumn(1).width = 18;
    worksheet.getColumn(2).width = 22;
    worksheet.getColumn(3).width = 22;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 10;
    worksheet.getColumn(6).width = 8;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 10;
    worksheet.getColumn(10).width = 14;
    worksheet.getColumn(11).width = 14;
    worksheet.getColumn(12).width = 14;
    worksheet.getColumn(13).width = 16;
    worksheet.getColumn(14).width = 25;
    worksheet.getColumn(15).width = 14;
    worksheet.getColumn(16).width = 14;

    // =============================================
    // DATA ROWS
    // =============================================
    orders.forEach((order, index) => {
      const rowData = [
        order.order_number || '',
        `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'N/A',
        order.company_name || 'N/A',
        order.fuel_type || '',
        order.quantity || 0,
        order.unit || 'L',
        parseFloat(order.unit_price || 0).toFixed(2),
        parseFloat(order.total_amount || 0).toFixed(2),
        parseFloat(order.tax_amount || 0).toFixed(2),
        parseFloat(order.grand_total || 0).toFixed(2),
        order.status || '',
        order.payment_status || '',
        order.purchase_order_number || '',
        order.delivery_address || '',
        order.created_at ? new Date(order.created_at).toLocaleDateString() : '',
        order.completed_at ? new Date(order.completed_at).toLocaleDateString() : ''
      ];

      const row = worksheet.addRow(rowData);
      
      // Style rows
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });

      // Alternate row colors
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        });
      }
    });

    // =============================================
    // GRAND TOTAL
    // =============================================
    worksheet.addRow([]);
    const totalRowData = ['', '', '', '', '', '', '', 'TOTAL:', '', `$${totalRevenue.toFixed(2)}`];
    const totalRow = worksheet.addRow(totalRowData);
    totalRow.font = { name: 'Arial', size: 11, bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // =============================================
    // SEND FILE
    // =============================================
    const filename = `GlowBulk_Orders_Report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
    
    res.setHeader(
      'Content-Type', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=${filename}`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting monthly orders report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting monthly orders report',
      error: error.message
    });
  }
};

module.exports = {
  exportCustomers,
  exportMonthlyReport,
  exportMonthlyOrdersReport
};