// scratch/inspect_sched.cjs
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const filePath = path.resolve(__dirname, '../توزيع المراقبين  1261.xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

for (let i = 0; i < 30; i++) {
  console.log(`R${i + 1}:`, JSON.stringify(rows[i]));
}
