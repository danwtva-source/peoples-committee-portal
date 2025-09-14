import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const XLSX_PATH = process.env.XLSX_PATH || 'data/Replit Users Committee Members.xlsx';
const OUT_PATH  = process.env.OUT_PATH  || 'api/users.json';

function loadSheet(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.find(n => Object.keys(wb.Sheets[n] || {}).length > 0);
  if (!sheetName) throw new Error('No sheets found');
  return xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
}

function parseUsers(rows) {
  const idx = rows.findIndex(r => (r[1]||"").toString().trim().toLowerCase() === "user");
  if (idx < 0) throw new Error('Header row with "User" not found');
  const data = rows.slice(idx+1).map(r => ({
    name: r[1] || "",
    area: r[2] || "",
    username: r[3] || "",
    role: (r[4] || "").toLowerCase().includes("admin") ? "admin" : "member"
  })).filter(r => r.username);

  const ensure = (username, name) => {
    if (!data.some(u => u.username.toLowerCase() === username)) {
      data.push({ username, name, area: "ALL", role: "admin" });
    }
  };
  ensure("dwatkins", "Dan Watkins");
  ensure("tvaadmin", "TVA Admin");
  return data;
}

const rows = loadSheet(XLSX_PATH);
const users = parseUsers(rows);
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(users, null, 2), "utf8");
console.log(`Wrote ${users.length} users to ${OUT_PATH}`);