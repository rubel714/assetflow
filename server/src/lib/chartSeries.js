function padMonth(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthKeys(count, start) {
  const keys = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  for (let i = 0; i < count; i += 1) {
    keys.push(padMonth(d.getFullYear(), d.getMonth()));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function pastMonthKeys(count) {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (count - 1));
  return monthKeys(count, start);
}

function upcomingMonthKeys(count) {
  return monthKeys(count, new Date());
}

function fillMonths(months, rows, valueKey = "c") {
  const map = Object.fromEntries(months.map((m) => [m, 0]));
  for (const row of rows || []) {
    const key = row.ym;
    if (key in map) map[key] = Number(row[valueKey] || 0);
  }
  return months.map((m) => map[m]);
}

function namedTotals(rows, nameKey = "name", valueKey = "total") {
  return (rows || []).map((row) => ({
    name: row[nameKey] || "Unassigned",
    value: Number(row[valueKey] || 0),
  }));
}

module.exports = {
  pastMonthKeys,
  upcomingMonthKeys,
  fillMonths,
  namedTotals,
};
