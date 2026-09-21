const ExcelJS = require('exceljs');

/**
 * Builds a styled .xlsx gradebook report and returns it as a Buffer.
 * Used for both quiz results and exercise grades - same shape of report,
 * just different column sets, so one shared builder covers both.
 *
 * @param {object} opts
 * @param {string} opts.title - report title, shown as a merged header row
 * @param {string} opts.subtitle - e.g. class name and generation date
 * @param {string[]} opts.columns - column headers, in order
 * @param {Array<Array<string|number>>} opts.rows - row data, matching columns order
 */
async function generateGradebookExcel({ title, subtitle, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MOMA LMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, columns.length);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
  headerRow.height = 22;

  rows.forEach((rowData, rIdx) => {
    const row = sheet.getRow(5 + rIdx);
    rowData.forEach((value, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = value;
      cell.alignment = { vertical: 'middle' };
      if (rIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  columns.forEach((col, i) => {
    const maxContentLength = Math.max(
      col.length,
      ...rows.map((r) => String(r[i] ?? '').length)
    );
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxContentLength + 4, 12), 40);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateGradebookExcel };
