import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, any>;
}

export function parseFileContent(
  buffer: Buffer,
  filename: string
): { headers: string[]; rows: ParsedRow[] } {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    const text = buffer.toString('utf8');
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return {
      headers: parsed.meta.fields || [],
      rows: parsed.data.map((data, idx) => ({ rowNumber: idx + 2, data })),
    };
  }

  // Excel (.xlsx, .xls)
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (json.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = json[0].map((h: any) => String(h).trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < json.length; i++) {
    const rowValues = json[i];
    const data: Record<string, any> = {};
    let hasData = false;
    headers.forEach((h: string, colIdx: number) => {
      const val = rowValues[colIdx];
      data[h] = val;
      if (val !== undefined && val !== '') hasData = true;
    });
    if (hasData) {
      rows.push({ rowNumber: i + 1, data });
    }
  }

  return { headers, rows };
}

