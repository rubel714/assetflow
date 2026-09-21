export function chartPalette(theme = "dark") {
  const light = theme === "light";
  return {
    theme,
    text: light ? "#0f172a" : "#f8fafc",
    muted: light ? "#475569" : "#94a3b8",
    accent: light ? "#0284c7" : "#22d3ee",
    border: light ? "rgba(148, 163, 184, 0.45)" : "rgba(148, 163, 184, 0.35)",
    tooltipBg: light ? "#ffffff" : "#0f172a",
    tooltipText: light ? "#0f172a" : "#f8fafc",
    colors: ["#22d3ee", "#818cf8", "#34d399", "#f59e0b", "#f472b6", "#38bdf8", "#a78bfa", "#fb7185"],
  };
}

function formatMonth(ym) {
  if (!ym) return "";
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function axisStyle(palette) {
  return {
    axisLine: { lineStyle: { color: palette.border } },
    axisLabel: { color: palette.muted },
    splitLine: { lineStyle: { color: palette.border, type: "dashed" } },
  };
}

function tooltipStyle(palette) {
  return {
    show: true,
    backgroundColor: palette.tooltipBg,
    borderColor: palette.border,
    borderWidth: 1,
    textStyle: { color: palette.tooltipText, fontSize: 12 },
    extraCssText: `color:${palette.tooltipText};background:${palette.tooltipBg};z-index:20;`,
  };
}

function lineOption(palette, { categories, series, yName }) {
  return {
    color: palette.colors,
    textStyle: { fontFamily: "Inter, sans-serif" },
    tooltip: { trigger: "axis", ...tooltipStyle(palette) },
    legend: { top: 0, textStyle: { color: palette.muted } },
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    xAxis: { type: "category", data: categories, ...axisStyle(palette), splitLine: { show: false } },
    yAxis: { type: "value", name: yName, nameTextStyle: { color: palette.muted }, min: 0, minInterval: 1, ...axisStyle(palette) },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      smooth: true,
      data: s.data,
      showSymbol: false,
    })),
  };
}

function moneyLabel(value) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pieOption(palette, { data, money = false, seriesName = "Value" }) {
  const slices = (data || []).filter((row) => Number(row.value) > 0);
  const pieData = slices.length ? slices : [{ name: "No value", value: 0 }];
  return {
    color: palette.colors,
    textStyle: { fontFamily: "Inter, sans-serif" },
    tooltip: {
      trigger: "item",
      ...tooltipStyle(palette),
      formatter: (item) => {
        const value = money ? moneyLabel(item.value) : Number(item.value).toLocaleString();
        return `${item.seriesName}<br/>${item.marker}${item.name}: ${value} (${item.percent}%)`;
      },
    },
    legend: {
      orient: "horizontal",
      bottom: 0,
      left: "center",
      textStyle: { color: palette.muted },
    },
    series: [
      {
        name: seriesName,
        type: "pie",
        radius: "45%",
        center: ["50%", "44%"],
        data: pieData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
        label: {
          show: true,
          color: palette.text,
          formatter: "{b}",
        },
        labelLine: {
          show: true,
          lineStyle: { color: palette.muted },
        },
      },
    ],
  };
}

function barOption(palette, { categories, series, stacked = false, horizontal = false, money = false }) {
  const catAxis = {
    type: "category",
    data: categories,
    ...axisStyle(palette),
    splitLine: { show: false },
    axisLabel: { color: palette.muted, interval: 0, rotate: horizontal ? 0 : categories.length > 8 ? 35 : 0 },
  };
  const valueAxis = {
    type: "value",
    min: 0,
    ...axisStyle(palette),
    axisLabel: {
      color: palette.muted,
      formatter: money ? (v) => Number(v).toLocaleString() : undefined,
    },
  };
  return {
    color: palette.colors,
    textStyle: { fontFamily: "Inter, sans-serif" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...tooltipStyle(palette),
      valueFormatter: money ? (v) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : undefined,
    },
    legend: { top: 0, textStyle: { color: palette.muted } },
    grid: { left: 8, right: 16, top: series.length > 1 ? 36 : 16, bottom: 4, containLabel: true },
    xAxis: horizontal ? valueAxis : catAxis,
    yAxis: horizontal ? catAxis : valueAxis,
    series: series.map((s) => ({
      name: s.name,
      type: "bar",
      stack: stacked ? "total" : undefined,
      barMaxWidth: 28,
      data: s.data,
    })),
  };
}

export function buildDashboardCharts(charts, palette) {
  if (!charts) return [];
  const months = (charts.months || []).map(formatMonth);
  const warrantyMonths = (charts.warrantyMonths || []).map(formatMonth);
  const deptNames = (charts.assetsByDepartment || []).map((r) => r.name);
  const locNames = (charts.assetsByLocation || []).map((r) => r.name);

  return [
    {
      section: "Operations",
      title: "Maintenance count by month",
      option: lineOption(palette, {
        categories: months,
        series: [
          { name: "Opened", data: charts.maintenanceOpened || [] },
          { name: "Completed", data: charts.maintenanceCompleted || [] },
        ],
      }),
    },
    {
      section: "Cost",
      title: "Maintenance spend by month",
      option: barOption(palette, {
        categories: months,
        money: true,
        series: [{ name: "Spend", data: charts.maintenanceSpend || [] }],
      }),
    },
    {
      section: "Cost",
      title: "Purchase cost by month",
      option: barOption(palette, {
        categories: months,
        money: true,
        series: [{ name: "Purchase cost", data: charts.purchaseCost || [] }],
      }),
    },
    {
      section: "Cost",
      title: "Asset value by category",
      height: 320,
      option: pieOption(palette, {
        money: true,
        seriesName: "Value",
        data: charts.valueByCategory || [],
      }),
    },
    {
      section: "Fleet",
      title: "Assets by department",
      option: barOption(palette, {
        categories: deptNames.length ? deptNames : ["—"],
        series: [{ name: "Assets", data: deptNames.length ? charts.assetsByDepartment.map((r) => r.value) : [0] }],
      }),
    },
    {
      section: "Fleet",
      title: "Assets by location",
      option: barOption(palette, {
        categories: locNames.length ? locNames : ["—"],
        series: [{ name: "Assets", data: locNames.length ? charts.assetsByLocation.map((r) => r.value) : [0] }],
      }),
    },
    {
      section: "Fleet",
      title: "Warranties expiring (next 6 months)",
      option: barOption(palette, {
        categories: warrantyMonths,
        series: [{ name: "Expiring", data: charts.warrantiesUpcoming || [] }],
      }),
    },
    {
      section: "Activity",
      title: "Assignments vs transfers",
      option: lineOption(palette, {
        categories: months,
        series: [
          { name: "Assignments", data: charts.assignments || [] },
          { name: "Transfers", data: charts.transfers || [] },
        ],
      }),
    },
    {
      section: "Activity",
      title: "Asset requests by month",
      option: barOption(palette, {
        categories: months,
        stacked: true,
        series: [
          { name: "Pending", data: charts.requestsByStatus?.pending || [] },
          { name: "Approved", data: charts.requestsByStatus?.approved || [] },
          { name: "Rejected", data: charts.requestsByStatus?.rejected || [] },
          { name: "Cancelled", data: charts.requestsByStatus?.cancelled || [] },
        ],
      }),
    },
  ];
}
