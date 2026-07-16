const borderColor = getComputedStyle(document.documentElement).getPropertyValue("--border-color");
const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue("--foreground-color");
const targetColor = getComputedStyle(document.documentElement).getPropertyValue("--bad-color");
const comparisonColor = getComputedStyle(document.documentElement).getPropertyValue("--good-color");

const targetColorA = targetColor.replace(/rgb/i, "rgba").replace(/\)/i, ",0.15)");
const comparisonColorA = comparisonColor.replace(/rgb/i, "rgba").replace(/\)/i, ",0.15)");

Chart.defaults.borderColor = borderColor;
Chart.defaults.color = foregroundColor;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = true;
Chart.defaults.plugins.decimation = false;
Chart.defaults.plugins.legend.display = !window.mobileCheck();
Chart.defaults.plugins.tooltip.multiKeyBackground = "black";

let searchData = {
  comparison: {
    power: 0,
    stats: [0, 0, 0, 0, 0, 0],
  },
  target: {
    power: 0,
    stats: Array.from(input.targets, (target) => Number(target.value)),
  },
};

const chartAspectRatio = 1;
const chartIcons = ["\u002b", "\uf5b0", "\uf625", "\uf076", "\uf021", "\uf337"];
const chartLabels = ["Durability", "Thrust", "Top Speed", "Stability", "Steer", "Strafe"];
const chartLabelColors = new Array(6).fill(foregroundColor);
const chartRadarLabels = new Array(6).fill("");
const chartBarsLabels = [
  ["DUR", ""],
  ["THR", ""],
  ["SPD", ""],
  ["STB", ""],
  ["STR", ""],
  ["STF", ""],
];

const chartData = [
  {
    label: "Target",
    data: searchData.target.stats,
    fill: true,
    borderWidth: 2,
    backgroundColor: targetColorA,
    borderColor: targetColor,
    borderDash: [6, 6],
    pointHitRadius: 25,
    pointBorderWidth: 0,
    pointBackgroundColor: targetColorA,
    pointBorderColor: targetColor,
    pointHoverBackgroundColor: targetColor,
    pointHoverBorderColor: targetColor,
  },
  {
    label: "Comparison",
    data: searchData.comparison.stats,
    fill: true,
    hidden: true,
    borderWidth: 2,
    borderColor: comparisonColor,
    backgroundColor: comparisonColorA,
    pointHitRadius: 25,
    pointBorderWidth: 0,
    pointBackgroundColor: comparisonColorA,
    pointBorderColor: comparisonColor,
    pointHoverBackgroundColor: comparisonColor,
    pointHoverBorderColor: comparisonColor,
  },
];

const ctxRadar = document.getElementById("chart-radar").getContext("2d");
const ctxBars = document.getElementById("chart-bars").getContext("2d");

let chartRadar = new Chart(ctxRadar, {
  type: "radar",
  data: {
    labels: chartRadarLabels,
    datasets: chartData,
  },
  options: {
    aspectRatio: chartAspectRatio,
    onHover: function (e) {
      const point = e.chart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (point.length) e.native.target.style.cursor = "grab";
      else e.native.target.style.cursor = "default";
    },
    plugins: {
      legend: {
        labels: {
          font: {
            weight: "bold",
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: function (tooltipItem) {
            return chartLabels[tooltipItem[0].dataIndex];
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) label += ": ";
            if (context.parsed.r !== null) {
              let stat = Math.round(context.parsed.r);
              label += `${stat} (${(stat / 40).toLocaleString(...chartFormat)})`;
              // label += `${stat}`;
              if (context.dataIndex == 2) return [label, `${redoutDB.graphs.speed[stat]} km/h (${Math.round(redoutDB.graphs.speed[stat] / 1.609344)} mph)`];
            }
            return label;
          },
        },
      },
      dragData: {
        round: 1,
        onDragStart: function (e, element) {
          if (!(element === 0)) return false;
        },
        onDrag: function (e, datasetIndex, index, value) {
          if (!(datasetIndex === 0)) return false;
          if (value < 0) value = 0;
          if (value > 40) value = 40;
          // e.target.style.cursor = "grabbing";
        },
        onDragEnd: function (e, datasetIndex, index, value) {
          if (!(datasetIndex === 0)) return false;
          if (value < 0) value = 0;
          if (value > 40) value = 40;
          targetInputChange(e, index, value);
        },
        magnet: {
          to: Math.round,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        suggestedMax: 40 * (4 / 7),
        beginAtZero: true,
        ticks: {
          callback: function (value, index, ticks) {
            return input.option.percentageScale.checked ? ((value * 100) / 40).toLocaleString(...statFormat) : value.toLocaleString(...statFormat);
          },
          // display: false,
          display: !window.mobileCheck(),
          showLabelBackdrop: false,
          textStrokeColor: "black",
          textStrokeWidth: 2,
          stepSize: 40 / 7,
          z: 0,
        },
        pointLabels: {
          display: !window.mobileCheck(),
          centerPointLabels: false,
          padding: -5,
          color: chartLabelColors,
          font: {
            weight: "bold",
            size: 16,
          },
        },
      },
    },
  },
});

let chartBars = new Chart(ctxBars, {
  type: "bar",
  data: {
    labels: chartBarsLabels,
    datasets: chartData,
  },
  options: {
    aspectRatio: chartAspectRatio,
    indexAxis: "y",
    scales: {
      x: {
        min: 0,
        suggestedMax: 40,
        beginAtZero: true,
        ticks: {
          callback: function (value, index, ticks) {
            return input.option.percentageScale.checked ? ((value * 100) / 40).toLocaleString(...statFormat) : value.toLocaleString(...statFormat);
          },
          display: !window.mobileCheck(),
          stepSize: 40 / 7,
        },
      },
      y: {
        ticks: {
          display: !window.mobileCheck(),
          color: chartLabelColors,
          font: {
            weight: "bold",
            size: 16,
          },
        },
      },
    },
    onHover: function (e) {
      const point = e.chart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
      if (point.length) e.native.target.style.cursor = "grab";
      else e.native.target.style.cursor = "default";
    },
    plugins: {
      legend: {
        labels: {
          font: {
            weight: "bold",
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: function (tooltipItem) {
            return chartLabels[tooltipItem[0].dataIndex];
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) label += ": ";
            if (context.parsed.x !== null) {
              let stat = Math.round(context.parsed.x);
              label += `${stat} (${(stat / 40).toLocaleString(...chartFormat)})`;
              // label += `${stat}`;
              if (context.dataIndex == 2) return [label, `${redoutDB.graphs.speed[stat]} km/h (${Math.round(redoutDB.graphs.speed[stat] / 1.609344)} mph)`];
            }
            return label;
          },
        },
      },
      dragData: {
        round: 1,
        showTooltip: true,
        onDragStart: function (e, element) {
          if (!(element === 0)) return false;
        },
        onDrag: function (e, datasetIndex, index, value) {
          if (!(datasetIndex === 0)) return false;
          if (value < 0) value = 0;
          if (value > 40) value = 40;
          // e.target.style.cursor = "grabbing";
        },
        onDragEnd: function (e, datasetIndex, index, value) {
          if (!(datasetIndex === 0)) return false;
          if (value < 0) value = 0;
          if (value > 40) value = 40;
          targetInputChange(e, index, value);
        },
        magnet: {
          to: Math.round,
        },
      },
    },
  },
});
