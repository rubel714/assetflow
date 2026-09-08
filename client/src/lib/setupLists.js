export function pickList(data, key) {
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function rowId(row, idKey) {
  return row?.[idKey] ?? row?.id;
}
