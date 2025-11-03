const input = {
  buttons: {
    query: document.getElementById("button-query"),
    queryIcon: document.getElementById("query-icon"),
    save: document.getElementById("button-save"),
  },
  id: document.getElementById("select-id"),
  ships: document.getElementById("select-ship"),
  power: {
    min: !mobileCheck() ? document.getElementById("slider-power-min") : document.getElementById("select-power-min"),
    max: !mobileCheck() ? document.getElementById("slider-power-max") : document.getElementById("select-power-max"),
    minAlt: mobileCheck() ? document.getElementById("slider-power-min") : document.getElementById("select-power-min"),
    maxAlt: mobileCheck() ? document.getElementById("slider-power-max") : document.getElementById("select-power-max"),
  },
  targets: [document.getElementById("select-durability"), document.getElementById("select-thrust"), document.getElementById("select-speed"), document.getElementById("select-stability"), document.getElementById("select-steer"), document.getElementById("select-strafe")],
  types: [document.getElementById("select-propulsor"), document.getElementById("select-stabilizer"), document.getElementById("select-rudder"), document.getElementById("select-hull"), document.getElementById("select-intercooler"), document.getElementById("select-esc")],
  option: {
    greaterOnly: document.getElementById("check-greaterOnly"),
    percentageScale: document.getElementById("check-percentageScale"),
  },
};

const output = {
  headings: document.getElementById("row-headings").querySelectorAll("th"),
  table: document.getElementById("tbody-results"),
  power: document.getElementById("power-label"),
  ships: document.getElementById("ship-datalist"),
  chart: {
    target: {
      id: document.getElementById("header-target-id"),
      ship: document.getElementById("header-target-ship"),
      power: document.getElementById("header-target-power"),
      stats: [document.getElementById("cell-target-durability"), document.getElementById("cell-target-thrust"), document.getElementById("cell-target-speed"), document.getElementById("cell-target-stability"), document.getElementById("cell-target-steer"), document.getElementById("cell-target-strafe")],
      parts: [document.getElementById("cell-target-propulsor"), document.getElementById("cell-target-stabilizer"), document.getElementById("cell-target-rudder"), document.getElementById("cell-target-hull"), document.getElementById("cell-target-intercooler"), document.getElementById("cell-target-esc")],
    },
    comparison: {
      id: document.getElementById("header-comparison-id"),
      ship: document.getElementById("header-comparison-ship"),
      power: document.getElementById("header-comparison-power"),
      stats: [document.getElementById("cell-comparison-durability"), document.getElementById("cell-comparison-thrust"), document.getElementById("cell-comparison-speed"), document.getElementById("cell-comparison-stability"), document.getElementById("cell-comparison-steer"), document.getElementById("cell-comparison-strafe")],
      parts: [document.getElementById("cell-comparison-propulsor"), document.getElementById("cell-comparison-stabilizer"), document.getElementById("cell-comparison-rudder"), document.getElementById("cell-comparison-hull"), document.getElementById("cell-comparison-intercooler"), document.getElementById("cell-comparison-esc")],
    },
    delta: {
      power: document.getElementById("header-delta-power"),
      stats: [document.getElementById("cell-delta-durability"), document.getElementById("cell-delta-thrust"), document.getElementById("cell-delta-speed"), document.getElementById("cell-delta-stability"), document.getElementById("cell-delta-steer"), document.getElementById("cell-delta-strafe")],
    },
  },
  info: document.getElementById("info-banner"),
};

const deltaFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2, signDisplay: "exceptZero" }];
const chartFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2 }];
const statFormat = ["en-US", { maximumSignificantDigits: 2 }];

// If there are previous queries saved in local storage, use them
let lastQuery = JSON.parse(localStorage.getItem("lastQuery"));

// Read data.json to store it in redoutDB and populate some web elements
const partCode = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];
const partType = ["propulsor", "stabilizer", "rudder", "hull", "intercooler", "esc"];
let redoutDB;
fetch("./src/data.json")
  .then((response) => response.json())
  .then((json) => {
    redoutDB = json;
    redoutDB.gliders.forEach((glider, i) => {
      input.ships.innerHTML += `<input class="checkbox-part" value="${i}" type="checkbox" onchange="glidersCheck(event)" id="checkbox-${glider.code}" ${lastQuery ? lastQuery.gliders.includes(i) && "checked" : "checked"} hidden /><label for="checkbox-${glider.code}" class="label-checkbox" title="${glider.name} (${glider.code}) {${glider.power}} [${glider.stats}]\n\n${glider.desc}"><img src='./img/${glider.code}.webp'></label>`;
      output.ships.innerHTML += `<option value='${glider.code}'>`;
    });
    redoutDB.parts.forEach((part, i) => {
      part.details.forEach((detail, j) => {
        Object.assign(detail, { id: partCode[j] });
        input.types[i].innerHTML += `<input class="checkbox-part part-class-${detail.class}" value="${j}" type="checkbox" onchange="partsCheck(event,${i},'${part.type}')" id="checkbox-${detail.code}" ${lastQuery ? lastQuery.parts[i].includes(j) && "checked" : (detail.class == "S" || detail.class == "X") && "checked"} hidden /><label for="checkbox-${detail.code}" class="label-checkbox part-class-${detail.class}" title="${detail.name} (${detail.class}) {${detail.power}} [${detail.stats}]\n\n${detail.desc}">${detail.code}</label>`;
      });
      partsCheck(new Event("Initialize"), i, part.type);
    });
    if (mobileCheck()) {
      input.power.minAlt.classList.add("hide");
      input.power.maxAlt.classList.add("hide");
      input.power.min.classList.remove("hide");
      input.power.max.classList.remove("hide");
    }
    if (lastQuery) {
      input.power.min.value = lastQuery.power[0];
      input.power.max.value = lastQuery.power[1];
      input.targets.forEach((target, i) => targetInputChange(target, i, lastQuery.stats[i]));
    }
    powerChange();
  });

function scaleChange(e) {
  e.preventDefault();
  if (output.table.innerHTML != "") {
    output.table.innerHTML = parseResults(
      Array.from(queries.results.at(queries.current), (result) => parseResult(result.id, result.delta)),
      queries.inputs.at(queries.current)
    );
  }
  updateStatCharts(0, searchData.target.stats, selectedRig.id != "" ? parseResult(selectedRig.id) : null);
}

function quickSelect(e, parts) {
  e.preventDefault();
  let active = document.querySelector(`.part-selector:not(.hide)`);
  let type = active.id.split("-")[1];
  let checkboxes = document.querySelectorAll(`#${active.id} input[type = "checkbox"]`);
  switch (parts) {
    case "base":
      checkboxes.forEach((checkbox) => (checkbox.checked = checkbox.classList.contains("part-class-C")));
      break;
    case "B":
      checkboxes.forEach((checkbox) => (checkbox.checked = checkbox.classList.contains("part-class-C") | checkbox.classList.contains("part-class-B")));
      break;
    case "A":
      checkboxes.forEach((checkbox) => (checkbox.checked = checkbox.classList.contains("part-class-B") | checkbox.classList.contains("part-class-A")));
      break;
    case "S":
      checkboxes.forEach((checkbox) => (checkbox.checked = checkbox.classList.contains("part-class-A") | checkbox.classList.contains("part-class-S")));
      break;
    case "X":
      checkboxes.forEach((checkbox) => (checkbox.checked = checkbox.classList.contains("part-class-S") | checkbox.classList.contains("part-class-X")));
      break;
    case "all":
      checkboxes.forEach((checkbox) => (checkbox.checked = true));
      break;
    default:
      break;
  }
  partsCheck(e, partType.indexOf(type), type);
}

function powerChange(e, range) {
  if (e) {
    e.preventDefault();
    if (!e.target.checkValidity()) e.target.value = e.target.defaultValue;
  }
  if (Number(input.power.min.value) >= Number(input.power.max.value)) {
    switch (range) {
      case "min":
        input.power.max.value = Number(input.power.min.value) + 25;
        break;
      case "max":
        input.power.min.value = Number(input.power.max.value) - 25;
        break;
      default:
        break;
    }
  }
  document.documentElement.style.setProperty("--power-min-value", `${Math.round((100 * (input.power.min.value - input.power.min.min)) / (input.power.min.max - input.power.min.min))}%`);
  document.documentElement.style.setProperty("--power-max-value", `${Math.round((100 * (input.power.max.value - input.power.max.min)) / (input.power.max.max - input.power.max.min))}%`);
  output.power.innerHTML = `${input.power.min.value}-${input.power.max.value}`;
}

let partPowers = {
  min: [],
  max: [],
};

function partsCheck(e, i, type) {
  e.preventDefault();
  let checked = document.querySelectorAll(`#select-${type} input[type = "checkbox"]:checked`);
  let checkedPowers = Array.from(checked, (part) => redoutDB.parts[i].details[Number(part.value)].power);
  partPowers.min[i] = Math.min(...checkedPowers);
  partPowers.max[i] = Math.max(...checkedPowers);
  input.power.min.value = 184 + partPowers.min.reduceRight((x, y) => x + y, 0) - 25;
  input.power.max.value = 184 + partPowers.max.reduceRight((x, y) => x + y, 0) + 25;
  if (checked.length == 0) quickSelect(e, "base");
  document.querySelector(`#label-${type}`).innerHTML = `${checked.length || 1}`;
  powerChange();
}

function glidersCheck(e) {
  e.preventDefault();
  let checked = document.querySelectorAll(`#select-ship input[type = "checkbox"]:checked`);
  if (checked.length == 0) document.querySelectorAll(`#select-ship input[type = "checkbox"]`).forEach((checkbox) => (checkbox.checked = true));
}

function changeChart(e, chart) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("chart-tab")).forEach((tabButton) => {
    tabButton.classList.remove("active");
  });
  Array.from(document.getElementsByClassName("charts")).forEach((chart) => {
    chart.style.display = "none";
  });
  e.currentTarget.classList.add("active");
  document.getElementById(`chart-${chart}`).style.display = "block";
}

function changeParts(e, part) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("column-select")).forEach((column) => {
    column.classList.remove("active");
  });
  Array.from(document.getElementsByClassName("part-selector")).forEach((part) => {
    part.classList.add("hide");
  });
  e.currentTarget.classList.add("active");
  document.getElementById(`select-${part}`).classList.remove("hide");
}

function columnSort(e, isNumber = false) {
  e.preventDefault();
  if (output.table.innerHTML != "") {
    if (e.currentTarget.classList.contains("active")) {
      e.currentTarget.classList.toggle("asc");
      if (e.currentTarget.classList.contains("asc")) {
        // Reset order
        output.headings.forEach((head) => head.classList.remove("active"));
        queries.results.at(queries.current).sort((a, b) => {
          return a.delta - b.delta;
        });
        output.table.innerHTML = parseResults(
          Array.from(queries.results.at(queries.current), (result) => parseResult(result.id, result.delta)),
          queries.inputs.at(queries.current)
        );
        return;
      }
    }
    output.headings.forEach((head) => head.classList.remove("active"));
    let column = e.currentTarget.cellIndex;
    let isAscending = e.currentTarget.classList.contains("asc") ? -1 : 1;
    let moveOperations = [];
    [...output.table.querySelectorAll("tr")]
      .sort((a, b) => {
        let firstRow = isNumber ? Number(a.querySelectorAll("td")[column].textContent.toLowerCase()) : a.querySelectorAll("td")[column].textContent.toLowerCase(),
          secondRow = isNumber ? Number(b.querySelectorAll("td")[column].textContent.toLowerCase()) : b.querySelectorAll("td")[column].textContent.toLowerCase();
        let direction = isAscending * (firstRow < secondRow ? -1 : 1);
        moveOperations.push(direction);
        return direction;
      })
      .map((sorted_row, i) => {
        output.table.appendChild(sorted_row);
      });
    let sortIteration = -1;
    queries.results.at(queries.current).sort((a, b) => {
      sortIteration++;
      return moveOperations[sortIteration];
    });
    e.currentTarget.classList.add("active");
  }
}

function downloadTable(e) {
  e.preventDefault();
  if (queries.results.length > 0) {
    const separator = ",";
    let csv = ["ID, Ship, Propulsor, Stabilizer, Rudder, Hull, Intercooler, ESC, Power, Durability, Thrust, Top_Speed, Stability, Steer, Strafe, Delta"];
    queries.results.at(queries.current).forEach((result) => {
      result = parseResult(result.id, result.delta);
      let row = [];
      row.push(result.id);
      row.push(result.glider.name);
      result.rig.forEach((part) => {
        row.push(part.code);
      });
      row.push(result.power);
      row.push(...result.stats);
      row.push(result.delta);
      csv.push(row.join(separator));
    });
    const file = `shipgen_${new Date().toLocaleDateString()}.csv`;
    let a = document.createElement("a");
    a.style.display = "none";
    a.setAttribute("target", "_blank");
    a.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(csv.join("\n"))}`);
    a.setAttribute("download", file);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function targetInputChange(e, i, value = -1) {
  if (value != -1) input.targets[i].value = value;
  if (!input.targets[i].checkValidity()) input.targets[i].value = input.targets[i].defaultValue;
  input.targets[i].value == 0 ? input.targets[i].classList.add("input-ignored") : input.targets[i].classList.remove("input-ignored");
  searchData.target.stats[i] = input.targets[i].value;
  if (e) {
    selectedRig = { glider: [{ code: "" }], id: "" };
    searchData.target.power = 0;
    updateStatCharts(0, searchData.target.stats);
  }
}

function selectIDChange(e) {
  if (!e.target.checkValidity()) e.target.value = "";
  e.target.value = e.target.value.toUpperCase();
}

function resetClick(e) {
  e.preventDefault();
  document.getElementById("form-query").reset();
  input.targets.forEach((target, i) => targetInputChange(null, i, target.value));
  searchData.target.power = 0;
  selectedRig = { glider: [{ code: "" }], id: "" };
  updateStatCharts(0, searchData.target.stats);
  redoutDB.parts.forEach((part, i) => partsCheck(e, i, part.type));
  powerChange();
}

function balanceTargets(e) {
  e.preventDefault();
  let nonZero = input.targets.filter((target) => target.value != 0);
  if (nonZero.length == 0) return;
  let average = Math.round(Array.from(nonZero, (target) => Number(target.value)).reduce((x, y) => x + y) / nonZero.length);
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(e, i, average);
    }
  });
}

function randomTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      // targetInputChange(e, i, clamp(Math.round(Number(target.value) + Number(target.value) * getRandomInt(-1, 2) * 0.1), 1, 40));
      targetInputChange(e, i, getRandomInt(1, 40));
    }
  });
}

function clamp(val, min, max) {
  return val > max ? max : val < min ? min : val;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function decreaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(e, i, Math.floor(Math.max(1, Number(searchData.target.stats[i]) * 0.9)));
    }
  });
}

function increaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(e, i, Math.ceil(Math.min(40, Number(searchData.target.stats[i]) * 1.1)));
    }
  });
}

function shiftTargetsRight(e) {
  e.preventDefault();
  let newTargets = new Array(6).fill(0);
  newTargets.forEach((target, i) => {
    newTargets[i] = searchData.target.stats[i ? i - 1 : newTargets.length - 1];
  });
  input.targets.forEach((target, i) => {
    targetInputChange(null, i, newTargets[i]);
  });
  searchData.target.power = 0;
  selectedRig = { glider: [{ code: "" }], id: "" };
  updateStatCharts(0, searchData.target.stats);
}

function shiftTargetsLeft(e) {
  e.preventDefault();
  let newTargets = new Array(6).fill(0);
  newTargets.forEach((target, i) => {
    if (i === input.targets.length - 1) {
      newTargets[i] = searchData.target.stats[0];
    } else {
      newTargets[i] = searchData.target.stats[i + 1];
    }
  });
  input.targets.forEach((target, i) => {
    targetInputChange(null, i, newTargets[i]);
  });
  searchData.target.power = 0;
  selectedRig = { glider: [{ code: "" }], id: "" };
  updateStatCharts(0, searchData.target.stats);
}

let selectedRig = { glider: [{ code: "" }], id: "" };
// Set Comparison to row hovered
function rowHover(e, row) {
  e.preventDefault();
  let result = parseResult(queries.results.at(queries.current)[row.rowIndex - 3].id);
  searchData.comparison.stats = result.stats;
  searchData.comparison.power = result.power;
  updateStatCharts(1, result.stats, result);
}

// Set Comparison to row clicked
// If ID is already selected, set Target and do a quick search of related results
function rowClick(e, row) {
  e.preventDefault();
  let result = parseResult(queries.results.at(queries.current)[row.rowIndex - 3].id);
  searchData.comparison.power = result.power;
  searchData.comparison.stats = result.stats;
  updateStatCharts(1, result.stats, result);
  output.info.innerHTML = "Click again to search similar";
  output.info.style.setProperty("filter", "invert(0%)");
  document.querySelectorAll(`#tbody-results tr`).forEach((row) => row.classList.remove("selected"));
  row.classList.add("selected");
  if (result.id === selectedRig.id) {
    input.targets.forEach((target, i) => {
      targetInputChange(null, i, result.stats[i] || 1);
    });
    searchData.target.power = result.power;
    updateStatCharts(0, result.stats, result);
    querySubmit(e, true);
  }
  selectedRig = result;
}

function statChange(comparison, target) {
  const change = new Array(6).fill("");
  const colors = new Array(6).fill(foregroundColor);
  const styles = new Array(6).fill("cell-neutral");
  for (let i = 0; i < change.length; i++) {
    if (target[i] == 0) {
      change[i] = "*";
    } else if (comparison[i] != 0) {
      let delta = input.option.percentageScale.checked ? (((comparison[i] - target[i]) * 100) / 40).toLocaleString(...statFormat) : comparison[i] - target[i];
      if (delta > 0) {
        change[i] = `+${delta}`;
        colors[i] = comparisonColor;
        styles[i] = "cell-good";
      } else if (delta < 0) {
        change[i] = `${delta}`;
        colors[i] = targetColor;
        styles[i] = "cell-bad";
      }
    }
  }

  return { delta: change, color: colors, style: styles };
}

function powerDelta(comparison, target) {
  let delta = comparison - target;
  if (delta == 0 || target == 0) {
    return "";
  }
  if (delta > 0) {
    return `+${delta}`;
  }
  return `${delta}`;
}

function updateStatCharts(dataset, data, result = null) {
  chartRadar, (chartBars.data.datasets[dataset].data = data);
  chartRadar, (chartBars.data.datasets[dataset].label = result ? result.id : "Target");
  chartRadar, (chartBars.data.datasets[dataset].hidden = false);

  let changes = statChange(searchData.comparison.stats, searchData.target.stats);
  let chartTable = dataset ? output.chart.comparison : output.chart.target;

  chartTable.id.innerHTML = result ? result.id : "Target";
  chartTable.ship.innerHTML = result && result.glider.nick;
  chartTable.ship.title = result ? `${result.glider.name} (${result.glider.code}) {${result.glider.power}} [${result.glider.stats}]\n\n${result.glider.desc}` : "N/A";
  chartTable.power.innerHTML = result ? result.power : "N/A";
  chartTable.power.style.setProperty("filter", result ? "invert(0%)" : "invert(100%)");
  output.chart.delta.power.innerHTML = powerDelta(searchData.comparison.power, searchData.target.power);

  data.forEach((data, i) => {
    chartRadarLabels[i] = changes.delta[i];
    chartBarsLabels[i][1] = changes.delta[i];
    chartRadar.options.scales.r.pointLabels.color[i] = changes.color[i];
    chartBars.options.scales.y.ticks.color[i] = changes.color[i];
    chartTable.parts[i].innerHTML = result && result.rig[i].code;
    chartTable.parts[i].title = result ? `${result.rig[i].name} (${result.rig[i].class}) {${result.rig[i].power}} [${result.rig[i].stats}]\n\n${result.rig[i].desc}` : "N/A";
    chartTable.stats[i].innerHTML = input.option.percentageScale.checked ? Math.round((100 * data) / 40) : data;
    output.chart.delta.stats[i].classList.remove("cell-neutral", "cell-good", "cell-bad");
    output.chart.delta.stats[i].classList.add(changes.style[i]);
    output.chart.delta.stats[i].innerHTML = changes.delta[i];
  });

  chartRadar.update();
  chartBars.update();
}
