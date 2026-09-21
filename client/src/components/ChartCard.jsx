import React from "react";
import ReactECharts from "echarts-for-react";

export default function ChartCard({ title, option, height = 280 }) {
  return (
    <div className="glass rounded-2xl p-5 min-w-0">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        style={{ height: height ?? 280 }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
