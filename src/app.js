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

// Defaults
input.targets.forEach((target) => (target.value = target.defaultValue));
input.option.percentageScale.checked = false;

// Common formats
const deltaFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2, signDisplay: "exceptZero" }];
const chartFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2 }];
const statFormat = ["en-US", { maximumSignificantDigits: 2 }];

// Common enums
const partCode = [..."123456789ABCDEFGHJK"];
const moduleType = ["Propulsor", "Stabilizer", "Rudder", "Hull", "Intercooler", "E.S.C."];
const moduleCode = ["propulsor", "stabilizer", "rudder", "hull", "intercooler", "esc"];
const statType = ["Durability", "Thrust", "Top Speed", "Stability", "Steer", "Strafe"];
const datasetType = ["Target", "Comparison"];
const scale = { toPercentage: 2.5, toGame: 0.4 };

// If there are previous queries or pinned saved in local storage, use them
let lastQuery = JSON.parse(localStorage.getItem("lastQuery"));
let lastPinned = JSON.parse(localStorage.getItem("lastPinned"));

// Read data.json to store it in redoutDB and populate some web elements
let redoutDB;
fetch("./src/data.json")
  .then((response) => response.json())
  .then((json) => {
    redoutDB = json;
    redoutDB.gliders.forEach((glider, i) => {
      input.ships.innerHTML += `<input class="checkbox-part" value="${i}" type="checkbox" onchange="glidersCheck(event)" id="checkbox-${glider.code}" ${lastQuery ? lastQuery.gliders.includes(i) && "checked" : "checked"} hidden /><label for="checkbox-${glider.code}" class="label-checkbox" title="${glider.name} &quot;${glider.code}&quot; \{${glider.power}\} \[${glider.stats}\]\n\n${glider.desc}"><img src='./img/${glider.code}.webp'></label>`;
      output.ships.innerHTML += `<option value='${glider.code}'>`;
    });
    redoutDB.parts.forEach((part, i) => {
      part.details.forEach((detail, j) => {
        Object.assign(detail, { id: partCode[j] });
        input.types[i].innerHTML += `<input class="checkbox-part part-class-${detail.class}" value="${j}" type="checkbox" onchange="partsCheck(event,${i})" id="checkbox-${detail.code}" ${lastQuery ? lastQuery.parts[i].includes(j) && "checked" : (detail.class == "S" || detail.class == "X") && "checked"} hidden /><label for="checkbox-${detail.code}" class="label-checkbox part-class-${detail.class}" title="${detail.name} &quot;${partCode[j]}&quot; \(${detail.class}\) \{${detail.power}\} \[${detail.stats}\]\n\n${detail.desc}">${detail.code}</label>`;
      });
      partsCheck(new Event("init"), i, false);
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
      input.targets.forEach((target, i) => targetInputChange(new Event("init"), i, lastQuery.stats[i]));
    }
    if (lastPinned) {
      pinnedRigs = lastPinned;
      output.table.innerHTML = parseResults(
        Array.from(pinnedRigs, (rig) => parseResult(rig)),
        queries.inputs.at(queries.current),
      );
    }
    powerChange();
  });

function scaleChange(e) {
  e.preventDefault();
  let max = e.srcElement.checked ? 100 : 40;
  let ratio = e.srcElement.checked ? scale.toPercentage : scale.toGame;
  input.targets.forEach((target) => (target.max = max));
  input.targets.forEach((target) => (target.defaultValue = max / 2));
  input.targets.forEach((target) => (target.value = Math.round(target.value * ratio)));
  output.headings.forEach((head) => head.classList.remove("active") && head.classList.add("asc"));
  if (output.table.innerHTML != "") {
    let pinnedCandidates = Array.from(pinnedRigs, (rig) => parseResult(rig));
    let candidates = Array.from(
      queries.results.at(queries.current).filter((result) => pinnedRigs.indexOf(result.id) === -1),
      (result) => parseResult(result.id, result.delta),
    );
    output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  }
  updateStatCharts(0, searchData.target.stats, targetedRig != "" ? parseResult(targetedRig) : null);
}

function quickSelect(e, parts, override = false) {
  e.preventDefault();
  let isCtrl = e.ctrlKey || override;
  let active = isCtrl ? document.querySelectorAll(`.part-selector`) : [document.querySelector(`.part-selector:not(.hide)`)];
  active.forEach((selector) => {
    let checkboxes = document.querySelectorAll(`#${selector.id} input[type = "checkbox"]`);
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
    partsCheck(e, selector.dataset.value, false);
  });
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

function partsCheck(e, i, canReset = true) {
  e.preventDefault();
  const type = moduleCode[i];
  if (e.type != "init") {
    let checked = document.querySelectorAll(`#select-${type} input[type = "checkbox"]:checked`);
    let checkboxes = document.querySelectorAll(`#select-${type} input[type = "checkbox"]`);
    if (checked.length == 0) checkboxes.forEach((checkbox) => (checkbox.checked = true));
    if (checked.length == checkboxes.length && canReset) {
      checkboxes.forEach((checkbox) => (checkbox.checked = false));
      e.srcElement.checked = true;
    }
  }
  let newChecked = document.querySelectorAll(`#select-${type} input[type = "checkbox"]:checked`);
  let checkedPowers = Array.from(newChecked, (part) => redoutDB.parts[i].details[Number(part.value)].power);
  partPowers.min[i] = Math.min(...checkedPowers);
  partPowers.max[i] = Math.max(...checkedPowers);
  input.power.min.value = 182 + partPowers.min.reduceRight((x, y) => x + y, 0) - 25;
  input.power.max.value = 186 + partPowers.max.reduceRight((x, y) => x + y, 0) + 25;
  document.querySelector(`#label-${type}`).innerHTML = `${newChecked.length}`;
  powerChange();
}

function glidersCheck(e) {
  e.preventDefault();
  let checked = document.querySelectorAll(`#select-ship input[type = "checkbox"]:checked`);
  let checkboxes = document.querySelectorAll(`#select-ship input[type = "checkbox"]`);
  if (checked.length == 0 || e.type == "reset") checkboxes.forEach((checkbox) => (checkbox.checked = true));
  if (checked.length == checkboxes.length && e.type != "reset") {
    checkboxes.forEach((checkbox) => (checkbox.checked = false));
    e.srcElement.checked = true;
  }
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

function columnSort(e) {
  e.preventDefault();
  if (output.table.innerHTML != "") {
    let pinnedCandidates = Array.from(pinnedRigs, (rig) => parseResult(rig));
    let candidates = Array.from(
      queries.results.at(queries.current).filter((result) => pinnedRigs.indexOf(result.id) === -1),
      (result) => parseResult(result.id, result.delta),
    );
    output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
    if (e.currentTarget.classList.contains("active")) {
      e.currentTarget.classList.toggle("asc");
      if (e.currentTarget.classList.contains("asc")) {
        // Reset order
        output.headings.forEach((head) => head.classList.remove("active"));
        candidates.sort((a, b) => {
          return a.delta - b.delta;
        });
        output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
        return;
      }
    }
    output.headings.forEach((head) => head.classList.remove("active"));
    let i = e.currentTarget.cellIndex;
    let isAscending = e.currentTarget.classList.contains("asc") ? -1 : 1;
    candidateSort(candidates, i, isAscending);

    output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
    e.currentTarget.classList.add("active");
  }
}

function candidateSort(candidates, i, isAscending) {
  if (i == 0) {
    candidates.sort((a, b) => {
      return isAscending * (a.id < b.id ? 1 : -1); // ID
    });
  } else if (i >= 1 && i <= 6) {
    candidates.sort((a, b) => {
      return isAscending * (a.rig[i - 1].power < b.rig[i - 1].power ? -1 : 1); // Rig
    });
  } else if (i == 7) {
    candidates.sort((a, b) => {
      return isAscending * (a.power < b.power ? -1 : 1); // Power
    });
  } else if (i >= 8 && i <= 13) {
    candidates.sort((a, b) => {
      return isAscending * (a.stats[i - 8] < b.stats[i - 8] ? -1 : 1); // Stats
    });
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
  if (!input.targets[i].checkValidity()) input.targets[i].value = Math.round(Number(input.targets[i].value));
  if (!input.targets[i].checkValidity()) input.targets[i].value = Number(input.targets[i].defaultValue);
  // If Value is set then it's something external wanting to change the targetInputs
  if (value == -1) {
    value = input.option.percentageScale.checked ? Math.round(Number(input.targets[i].value) * scale.toGame) : Number(input.targets[i].value);
  } else {
    input.targets[i].value = input.option.percentageScale.checked ? Math.round(Number(value) * scale.toPercentage) : Number(value);
  }
  searchData.target.stats[i] = Number(value);
  input.targets[i].value == 0 ? input.targets[i].classList.add("input-ignored") : input.targets[i].classList.remove("input-ignored");
  if (e.type != "quick") {
    searchData.target.power = 0;
    targetedRig = "";
  }
  updateStatCharts(0, searchData.target.stats);
}

function selectIDChange(e) {
  if (!e.target.checkValidity()) e.target.value = "";
  e.target.value = e.target.value.toUpperCase();
}

function resetClick(e) {
  e.preventDefault();
  input.id.value = input.id.defaultValue;
  input.targets.forEach((target, i) => targetInputChange(new Event("reset"), i, Number(target.defaultValue) * (input.option.percentageScale.checked ? scale.toGame : 1)));
  quickSelect(new Event("reset"), "X", true);
  glidersCheck(new Event("reset"));
}

function balanceTargets(e) {
  e.preventDefault();
  let nonZero = searchData.target.stats.filter((target) => target != 0);
  if (nonZero.length == 0) return;
  let average = Math.round(nonZero.reduce((x, y) => Number(x) + Number(y)) / nonZero.length);
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, average);
    }
  });
}

function randomTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.random() < 0.5 ? Math.floor(Math.max(1, Number(searchData.target.stats[i]) * 0.9)) : Math.ceil(Math.min(40, Number(searchData.target.stats[i]) * 1.1)));
    }
  });
}

function clamp(val, min, max) {
  return val > max ? max : val < min ? min : val;
}

function getRandomInt(a, b) {
  let min = a < b ? a : b;
  let max = a >= b ? a : b;
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function decreaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.floor(Math.max(1, Number(searchData.target.stats[i]) * 0.9)));
    }
  });
}

function increaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.ceil(Math.min(40, Number(searchData.target.stats[i]) * 1.1)));
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
    targetInputChange(new Event("reset"), i, newTargets[i]);
  });
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
    targetInputChange(new Event("reset"), i, newTargets[i]);
  });
}

let selectedRig = "";
let targetedRig = "";
let pinnedRigs = [];
let pinningID = false;

function idClick(e, cell) {
  e.preventDefault();
  let result = parseResult(cell.parentElement.title);
  if (pinnedRigs.indexOf(result.id) === -1) {
    pinnedRigs.push(result.id);
  } else {
    pinnedRigs.splice(pinnedRigs.indexOf(result.id), 1);
  }
  try {
    localStorage.setItem("lastPinned", JSON.stringify(pinnedRigs));
  } catch (e) {
    console.warn(e);
  }
  let pinnedCandidates = Array.from(pinnedRigs, (rig) => parseResult(rig));
  let candidates = Array.from(
    queries.results.at(queries.current).filter((result) => pinnedRigs.indexOf(result.id) === -1),
    (result) => parseResult(result.id, result.delta),
  );
  output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  pinningID = true;
}

// Set Comparison to row hovered
function rowHover(e, row) {
  e.preventDefault();
  let result = parseResult(row.title);
  searchData.comparison.stats = result.stats;
  searchData.comparison.power = result.power;
  updateStatCharts(1, result.stats, result);
}

// Set Comparison to row clicked
// If ID is already selected, set Target and do a quick search of related results
function rowClick(e, row) {
  e.preventDefault();
  if (pinningID) {
    pinningID = false;
    return;
  }
  let prevSelectedRig = selectedRig;
  selectedRig = row.title;
  let result = parseResult(selectedRig);
  let pinnedCandidates = Array.from(pinnedRigs, (rig) => parseResult(rig));
  searchData.comparison.power = result.power;
  searchData.comparison.stats = result.stats;
  updateStatCharts(1, result.stats, result);
  output.info.innerHTML = "Click again to search similar";
  output.info.style.setProperty("filter", "invert(0%)");
  let selectedRows = document.querySelectorAll("#tbody-results .selected");
  selectedRows.forEach((_row) => _row.classList.remove("selected"));
  row.classList.toggle("selected");
  // let candidates = Array.from(
  //   queries.results.at(queries.current).filter((result) => pinnedRigs.indexOf(result.id) === -1),
  //   (result) => parseResult(result.id, result.delta),
  // );
  // let active = Array.from(output.headings).filter((head) => head.classList.contains("active"))[0];
  // if (active) {
  //   let isAscending = active.classList.contains("asc") ? -1 : 1;
  //   candidateSort(candidates, active.cellIndex, isAscending);
  // }
  // output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  if (selectedRig === prevSelectedRig) {
    targetedRig = selectedRig;
    input.targets.forEach((target, i) => {
      targetInputChange(new Event("quick"), i, result.stats[i] || 1);
    });
    searchData.target.power = result.power;
    updateStatCharts(0, result.stats, result);
    querySubmit(e, true);
  }
}

function statChange(comparison, target) {
  const change = new Array(6).fill("");
  const colors = new Array(6).fill(foregroundColor);
  const styles = new Array(6).fill("cell-neutral");
  for (let i = 0; i < change.length; i++) {
    if (target[i] == 0) {
      change[i] = "*";
    } else if (comparison[i] != 0) {
      let delta = input.option.percentageScale.checked ? ((comparison[i] - target[i]) * scale.toPercentage).toLocaleString(...statFormat) : comparison[i] - target[i];
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

function getSpeeds(speed) {
  return (speed = { kmh: redoutDB.graphs.speed[speed], mph: Math.round(redoutDB.graphs.speed[speed] / 1.609344) });
}

function updateStatCharts(dataset, data, result = false) {
  (chartRadar, (chartBars.data.datasets[dataset].data = data));
  (chartRadar, (chartBars.data.datasets[dataset].label = result ? result.id : "Target"));
  (chartRadar, (chartBars.data.datasets[dataset].hidden = false));

  let changes = statChange(searchData.comparison.stats, searchData.target.stats);
  let chartTable = dataset ? output.chart.comparison : output.chart.target;
  let code = result ? [...result.id.split("-")[1]] : [..."000000"];

  chartTable.id.innerHTML = result ? result.id : `${datasetType[dataset]}`;
  chartTable.ship.innerHTML = result ? result.glider.nick : "Ship";
  chartTable.ship.title = result ? `${result.glider.name} \"${result.glider.code}\" \{${result.glider.power}\} \[${result.glider.stats}\]\n\n${result.glider.desc}` : `${datasetType[dataset]} Ship`;
  chartTable.power.innerHTML = result ? result.power : "N/A";
  chartTable.power.title = result ? `Actual power rating: ${result.weightedPower}` : `${datasetType[dataset]} Power`;
  chartTable.power.parentElement.classList.remove("cell-power-fault");
  if (result && result.power != result.weightedPower) chartTable.power.parentElement.classList.add("cell-power-fault");
  output.chart.delta.power.innerHTML = powerDelta(searchData.comparison.power, searchData.target.power);

  data.forEach((_data, i) => {
    chartRadarLabels[i] = changes.delta[i];
    chartBarsLabels[i][1] = changes.delta[i];
    chartRadar.options.scales.r.pointLabels.color[i] = changes.color[i];
    chartBars.options.scales.y.ticks.color[i] = changes.color[i];
    chartTable.parts[i].innerHTML = result ? result.rig[i].code : "-";
    chartTable.parts[i].title = result ? `${result.rig[i].name} \"${code[i]}\" \(${result.rig[i].class}\) \{${result.rig[i].power}\} \[${result.rig[i].stats}\]\n\n${result.rig[i].desc}` : `${datasetType[dataset]} ${moduleType[i]}`;
    chartTable.stats[i].innerHTML = input.option.percentageScale.checked ? (_data * scale.toPercentage).toLocaleString(...statFormat) : _data;
    if (i == 2) {
      const speed = getSpeeds(_data);
      chartTable.stats[i].title = `${datasetType[dataset]} ${statType[i]}`;
      chartTable.stats[i].title += `\n\n${speed.kmh} km/h (${speed.mph} mph)`;
    }
    output.chart.delta.stats[i].classList.remove("cell-neutral", "cell-good", "cell-bad");
    output.chart.delta.stats[i].classList.add(changes.style[i]);
    output.chart.delta.stats[i].innerHTML = changes.delta[i];
  });

  chartRadar.update();
  chartBars.update();
}
