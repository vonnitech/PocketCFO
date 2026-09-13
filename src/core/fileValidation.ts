export const MAX_STATEMENT_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_IMPORT_CELL_CHARS = 500;

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

export async function validateStatementFile(file: File): Promise<'csv' | 'xlsx' | 'xls'> {
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_STATEMENT_BYTES) throw new Error('Statement files must be 5 MB or smaller.');
  const ext = extension(file.name);
  if (!['.csv', '.xlsx', '.xls'].includes(ext)) throw new Error('Choose a CSV, XLSX, or XLS statement file.');

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (ext === '.xlsx') {
    const zip = head[0] === 0x50 && head[1] === 0x4b &&
      ((head[2] === 0x03 && head[3] === 0x04) || (head[2] === 0x05 && head[3] === 0x06));
    if (!zip) throw new Error('The XLSX file signature is invalid.');
    return 'xlsx';
  }
  if (ext === '.xls') {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
      .every((value, index) => head[index] === value);
    if (!ole) throw new Error('The XLS file signature is invalid.');
    return 'xls';
  }
  if (head.includes(0)) throw new Error('The CSV contains binary data.');
  return 'csv';
}

export function validateParsedTable(headers: string[], rows: Record<string, string>[]): void {
  if (headers.length === 0 || rows.length === 0) throw new Error('File has no recognizable rows or headers.');
  if (headers.length > MAX_IMPORT_COLUMNS) throw new Error(`Statements may contain at most ${MAX_IMPORT_COLUMNS} columns.`);
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Statements may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} rows.`);
  for (const header of headers) {
    if (header.length > MAX_IMPORT_CELL_CHARS) throw new Error('A column heading is too long.');
  }
  for (const row of rows) {
    if (Object.keys(row).length > MAX_IMPORT_COLUMNS) throw new Error(`Statements may contain at most ${MAX_IMPORT_COLUMNS} columns.`);
    if (Object.values(row).some(value => value.length > MAX_IMPORT_CELL_CHARS)) {
      throw new Error(`Individual statement values may contain at most ${MAX_IMPORT_CELL_CHARS} characters.`);
    }
  }
}

export function validateBackupFile(file: File): void {
  if (file.size <= 0) throw new Error('The selected backup is empty.');
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup files must be 2 MB or smaller.');
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a JSON backup file.');
}
