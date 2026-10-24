const WARRANTY_END_SQL = `LEAST(
  COALESCE(a.LastWarrantyDate, '9999-12-31'),
  COALESCE((SELECT MIN(w.EndDate) FROM asset_warranties w WHERE w.AssetId = a.AssetId), '9999-12-31')
)`;

module.exports = { WARRANTY_END_SQL };
