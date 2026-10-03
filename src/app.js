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
  extra: document.getElementById("table-extra"),
  info: document.getElementById("info-banner"),
};

// Defaults
input.targets.forEach((target) => (target.value = target.defaultValue));
input.option.percentageScale.checked = false;

// Common formats
const deltaFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2, signDisplay: "exceptZero" }];
const chartFormat = ["en-US", { style: "percent", maximumSignificantDigits: 2 }];
const statFormat = ["en-US", { maximumSignificantDigits: 2 }];
const extraPercentFormat = ["en-US", { style: "percent", maximumSignificantDigits: 4 }];
const extraFormat = ["en-US", { maximumSignificantDigits: 4 }];

// Common enums
const partCode = [..."123456789ABCDEFGHJK"];
const moduleType = ["Propulsor", "Stabilizer", "Rudder", "Hull", "Intercooler", "E.S.C."];
const moduleCode = ["propulsor", "stabilizer", "rudder", "hull", "intercooler", "esc"];
const statType = ["Durability", "Thrust", "Top Speed", "Stability", "Steer", "Strafe"];
const datasetType = ["Target", "Comparison"];
const scale = { toPercent: 2.5, toPermille: 0.025, toGame: 0.4, toKmh: 3.6, toMph: 0.621371 };

// Various rig related variables
let rigs = {
  pinned: [],
  isPinning: false,
  targeted: "",
  selected: "",
  prevSelected: "",
  comparison: {
    power: 0,
    stats: [0, 0, 0, 0, 0, 0],
  },
  target: {
    power: 0,
    stats: [0, 0, 0, 0, 0, 0],
  },
}

// Automatic power range variables
let partPowers = {
  min: [],
  max: [],
};

// Query history
let queries = {
  inputs: [{ stats: Array.from(input.targets, (target) => Number(target.value)), targeted: rigs.targeted }],
  results: [[]],
  current: -1,
  searching: false,
};

// If there are previous queries or pinned saved in local storage, use them
let lastQuery = JSON.parse(localStorage.getItem("lastQuery"));
let lastPinned = JSON.parse(localStorage.getItem("lastPinned"));

const debugMode = (localStorage.getItem("debugMode") == 'true');
if (debugMode) document.title += " <DBG>";

// Read data.json to store it in redoutDB and populate some web elements
let redoutDB;
fetch(debugMode ? "./src/debug.json" : "./src/data.json")
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
      queries.inputs.at(queries.current).stats = lastQuery.stats;
      queries.inputs.at(queries.current).targeted = lastQuery.targeted;
    }
    if (lastPinned) {
      rigs.pinned = lastPinned;
      output.table.innerHTML = parseResults(
        Array.from(rigs.pinned, (rig) => parseResult(rig)),
        queries.inputs.at(queries.current),
      );
    }
    powerChange();
  });

/**
 * Triggered by the Show Percentages checkbox changing.
 * Changes the scaling of the target inputs and outputs to either percentage or out of 40.
 */
function scaleChange(e) {
  e.preventDefault();
  let max = e.srcElement.checked ? 100 : 40;
  let ratio = e.srcElement.checked ? scale.toPercent : scale.toGame;
  input.targets.forEach((target) => (target.max = max));
  input.targets.forEach((target) => (target.defaultValue = max / 2));
  input.targets.forEach((target) => (target.value = Math.round(target.value * ratio)));
  output.headings.forEach((head) => head.classList.remove("active") && head.classList.add("asc"));
  if (output.table.innerHTML != "") {
    let pinnedCandidates = Array.from(rigs.pinned, (rig) => parseResult(rig));
    let candidates = Array.from(
      queries.results.at(queries.current).filter((result) => rigs.pinned.indexOf(result.id) === -1),
      (result) => parseResult(result.id, result.delta),
    );
    output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  }
  updateStatCharts(0, rigs.target.stats, rigs.targeted != "" ? parseResult(rigs.targeted) : null);
}

/**
 * Triggered by the part class buttons below the parts in the part selection box.
 * Sets the part pool or all modules to a certain class, depending if <Ctrl> is held.
 */
function quickSelect(e, parts, override = false) {
  e.preventDefault();
  const isCtrl = e.ctrlKey || override;
  const active = isCtrl ? document.querySelectorAll(`.part-selector`) : [document.querySelector(`.part-selector:not(.hide)`)];
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

/**
 * Triggered by the max and min power ranges changing value.
 * Properly rounds and clamps the new values, and updates how they look.
 */
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

/**
 * Triggered by any of the parts in the part selection box being changed, and by quickSelect to update the parts.
 * Updates the power range when parts are changed, and resets to all parts being selected if there's none selected.
 */
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

/**
 * Triggered by any of the ships in the ship selection box being changed.
 * Resets to all ships if there's none selected.
 */
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

/**
 * Triggered by the tabs above the charts.
 * Updates which charts are visible.
 */
function changeChart(e, chart) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("chart-tab")).forEach((tabBtn) => {
    tabBtn.classList.remove("active");
  });
  Array.from(document.getElementsByClassName("charts")).forEach((chart) => {
    chart.style.display = "none";
  });
  e.target.classList.add("active");
  document.getElementById(`chart-${chart}`).style.display = "flex";
  if (chart == 'extra') randomizeChartCurvesColors();
}

/**
 * Triggered by the tabs above the parts.
 * Updates which parts are visible.
 */
function changeParts(e, part) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("column-select")).forEach((column) => {
    column.classList.remove("active");
  });
  Array.from(document.getElementsByClassName("part-selector")).forEach((part) => {
    part.classList.add("hide");
  });
  e.target.classList.add("active");
  document.getElementById(`select-${part}`).classList.remove("hide");
}

/**
 * Triggered by clicking the icons above columns.
 * Sorts the results in various ways depending on the column. Such as alphabetical, value, or class.
 */
function columnSort(e) {
  e.preventDefault();
  if (output.table.innerHTML != "") {
    let pinnedCandidates = Array.from(rigs.pinned, (rig) => parseResult(rig));
    let candidates = Array.from(
      queries.results.at(queries.current).filter((result) => rigs.pinned.indexOf(result.id) === -1),
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

/**
 * Part of columnSort. Reads the values of a candidate to determine how to sort it.
 */
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

/**
 * Downloads the results into a CSV format.
 */
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

/**
 * Triggered by the target input values changing, either manually or by a quick search being performed.
 */
function targetInputChange(e, i, value = -1) {
  if (!input.targets[i].checkValidity()) input.targets[i].value = Math.round(Number(input.targets[i].value));
  if (!input.targets[i].checkValidity()) input.targets[i].value = Number(input.targets[i].defaultValue);
  // If Value is set then it's something external wanting to change the targetInputs
  if (value == -1) {
    value = input.option.percentageScale.checked ? Math.round(Number(input.targets[i].value) * scale.toGame) : Number(input.targets[i].value);
  } else {
    input.targets[i].value = input.option.percentageScale.checked ? Math.round(Number(value) * scale.toPercent) : Number(value);
  }
  rigs.target.stats[i] = Number(value);
  input.targets[i].value == 0 ? input.targets[i].classList.add("input-ignored") : input.targets[i].classList.remove("input-ignored");
  if (e.type != "quick") {
    rigs.target.power = 0;
    rigs.targeted = "";
  }
  updateStatCharts(0, rigs.target.stats);
}

/**
 * Triggered when the ShipGen ID field is changed.
 * Validates and formats it properly.
 */
function selectIDChange(e) {
  if (!e.target.checkValidity()) e.target.value = e.target.defaultValue;
  e.target.value = e.target.value.toUpperCase();
}

function shipClick(e, element) {
  if (e) {
    e.preventDefault();
    if (e.ctrlKey) {
      localStorage.setItem("debugMode", !debugMode);
      location.reload();
      return false;
    }
  }
}

function toggleDataset(e, datasetIndex) {
  e.preventDefault();
  const prevBtn = e.target.previousElementSibling;
  const nextBtn = e.target.nextElementSibling;
  e.target.classList.toggle("striked");
  if (prevBtn) prevBtn.classList.remove("striked");
  if (nextBtn) nextBtn.classList.remove("striked");
  const isVisible = e.target.classList.contains("striked");
  chartRadar.data.datasets.forEach((dataset, i) => {
    if (i == datasetIndex) {
      dataset.hidden = isVisible;
    } else {
      dataset.hidden = false;
    }
  });
  chartBars.data.datasets.forEach((dataset, i) => {
    if (i == datasetIndex) {
      dataset.hidden = isVisible;
    } else {
      dataset.hidden = false;
    }
  });
  chartForceCurves.data.datasets.forEach((dataset, i) => {
    if ((i & 1 == 1) == datasetIndex) {
      dataset.hidden = isVisible;
    } else {
      dataset.hidden = false;
    }
  });
  chartRadar.update();
  chartBars.update();
  chartForceCurves.update();
}

/**
 * Triggered by the reset button being clicked.
 * Resets all values to their defaults.
 */
function resetClick(e) {
  e.preventDefault();
  input.id.value = input.id.defaultValue;
  input.targets.forEach((target, i) => targetInputChange(new Event("reset"), i, Number(target.defaultValue) * (input.option.percentageScale.checked ? scale.toGame : 1)));
  quickSelect(new Event("reset"), "X", true);
  glidersCheck(new Event("reset"));
}

/**
 * Balances all targets by averages if they're not 0.
 */
function balanceTargets(e) {
  e.preventDefault();
  let nonZero = rigs.target.stats.filter((target) => target != 0);
  if (nonZero.length == 0) return;
  let average = Math.round(nonZero.reduce((x, y) => Number(x) + Number(y)) / nonZero.length);
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, average);
    }
  });
}

/**
 * Randomizes all targets by a small amount if they're not 0.
 */
function randomTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.random() < 0.5 ? Math.floor(Math.max(1, Number(rigs.target.stats[i]) * 0.9)) : Math.ceil(Math.min(40, Number(rigs.target.stats[i]) * 1.1)));
    }
  });
}

/**
 * Clamps values.
 */
function clamp(val, min, max) {
  return val > max ? max : val < min ? min : val;
}

/**
 * Returns a pseudo random value by range.
 */
function getRandomInt(a, b) {
  let min = a < b ? a : b;
  let max = a >= b ? a : b;
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Decreases targets by 10% relatively if they're not 0.
 */
function decreaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.floor(Math.max(1, Number(rigs.target.stats[i]) * 0.9)));
    }
  });
}

/**
 * Increases targets by 10% relatively if they're not 0.
 */
function increaseTargets(e) {
  e.preventDefault();
  input.targets.forEach((target, i) => {
    if (target.value != 0) {
      targetInputChange(new Event("reset"), i, Math.ceil(Math.min(40, Number(rigs.target.stats[i]) * 1.1)));
    }
  });
}

/**
 * Shifts all targets to the right, wrapping around if they're at the end.
 */
function shiftTargetsRight(e) {
  e.preventDefault();
  let newTargets = new Array(6).fill(0);
  newTargets.forEach((target, i) => {
    newTargets[i] = rigs.target.stats[i ? i - 1 : newTargets.length - 1];
  });
  input.targets.forEach((target, i) => {
    targetInputChange(new Event("reset"), i, newTargets[i]);
  });
}

/**
 * Shifts all targets to the left, wrapping around if they're at the end.
 */
function shiftTargetsLeft(e) {
  e.preventDefault();
  let newTargets = new Array(6).fill(0);
  newTargets.forEach((target, i) => {
    if (i === input.targets.length - 1) {
      newTargets[i] = rigs.target.stats[0];
    } else {
      newTargets[i] = rigs.target.stats[i + 1];
    }
  });
  input.targets.forEach((target, i) => {
    targetInputChange(new Event("reset"), i, newTargets[i]);
  });
}

/**
 * Triggered when the ID of a result is clicked.
 * Pins or unpins it to the top of the results list.
 */
function idClick(e, cell) {
  e.preventDefault();
  let result = parseResult(cell.parentElement.title);
  if (rigs.pinned.indexOf(result.id) === -1) {
    rigs.pinned.push(result.id);
  } else {
    rigs.pinned.splice(rigs.pinned.indexOf(result.id), 1);
  }
  try {
    localStorage.setItem("lastPinned", JSON.stringify(rigs.pinned));
  } catch (e) {
    console.warn(e);
  }
  let pinnedCandidates = Array.from(rigs.pinned, (rig) => parseResult(rig));
  let candidates = Array.from(
    queries.results.at(queries.current).filter((result) => rigs.pinned.indexOf(result.id) === -1),
    (result) => parseResult(result.id, result.delta),
  );
  output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  rigs.isPinning = true;
}

/**
 * Triggered when a result is hovered over.
 * Sets the Comparison information to the result.
 */
function rowHover(e, row) {
  e.preventDefault();
  let result = parseResult(row.title);
  rigs.comparison.stats = result.stats;
  rigs.comparison.power = result.power;
  updateStatCharts(1, result.stats, result);
}

/**
 * Triggered when a result is clicked or double clicked.
 * Also sets the Comparison information to the result. If it's already selected then it's set to the Target too and a quick search is performed.
 */
function rowClick(e, row) {
  e.preventDefault();
  if (rigs.isPinning) {
    rigs.isPinning = false;
    return;
  }
  rigs.prevSelected = rigs.selected;
  rigs.selected = row.title;
  let result = parseResult(rigs.selected);
  let pinnedCandidates = Array.from(rigs.pinned, (rig) => parseResult(rig));
  rigs.comparison.power = result.power;
  rigs.comparison.stats = result.stats;
  updateStatCharts(1, result.stats, result);
  output.info.innerHTML = "Click again to search similar";
  output.info.style.setProperty("filter", "invert(0%)");
  let selectedRows = document.querySelectorAll("#tbody-results .selected");
  selectedRows.forEach((_row) => _row.classList.remove("selected"));
  row.classList.toggle("selected");
  // let candidates = Array.from(
  //   queries.results.at(queries.current).filter((result) => rigs.pinned.indexOf(result.id) === -1),
  //   (result) => parseResult(result.id, result.delta),
  // );
  // let active = Array.from(output.headings).filter((head) => head.classList.contains("active"))[0];
  // if (active) {
  //   let isAscending = active.classList.contains("asc") ? -1 : 1;
  //   candidateSort(candidates, active.cellIndex, isAscending);
  // }
  // output.table.innerHTML = parseResults(pinnedCandidates.concat(candidates), queries.inputs.at(queries.current));
  if (rigs.selected === rigs.prevSelected) {
    rigs.targeted = rigs.selected;
    input.targets.forEach((target, i) => {
      targetInputChange(new Event("quick"), i, result.stats[i] || 1);
    });
    rigs.target.power = result.power;
    updateStatCharts(0, result.stats, result);
    querySubmit(e, true);
  }
}

/**
 * Formats stats for the VS. table.
 */
function statChange(comparison, target) {
  const change = new Array(6).fill("");
  const colors = new Array(6).fill(foregroundColor);
  const styles = new Array(6).fill("cell-neutral");
  for (let i = 0; i < change.length; i++) {
    if (target[i] == 0) {
      change[i] = "*";
    } else {
      let delta = input.option.percentageScale.checked ? ((comparison[i] - target[i]) * scale.toPercent).toLocaleString(...statFormat) : comparison[i] - target[i];
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

/**
 * Formats power for the VS. table.
 */
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

/**
 * Formats speed in both Km/h and Mph.
 */
function getSpeeds(speed) {
  return { kmh: speed, mph: speed * scale.toMph };
}

/**
 * Triggered any time stats are changed.
 * Updates both the Comparison or Target stats on the charts, VS. table or inputs.
 */
function updateStatCharts(dataset, data, result = false) {
  chartRadar, chartBars.data.datasets[dataset].data = data;
  // chartRadar, chartBars.data.datasets[dataset].label = result ? result.id : "Target";
  // chartRadar, chartBars.data.datasets[dataset].hidden = false;

  let changes = statChange(rigs.comparison.stats, rigs.target.stats);
  let chartTable = dataset ? output.chart.comparison : output.chart.target;
  let code = result ? [...result.id.split("-")[1]] : [..."000000"];

  // Reset the ID field if we're customizing the targets
  if (!result && dataset == 0) input.id.value = input.id.defaultValue;
  chartTable.id.innerHTML = result ? result.id : `${datasetType[dataset]}`;
  chartTable.ship.innerHTML = result ? result.glider.nick : "Ship";
  chartTable.ship.title = result ? `${result.glider.name} \"${result.glider.code}\" \{${result.glider.power}\} \[${result.glider.stats}\]\n\n${result.glider.desc}` : `${datasetType[dataset]} Ship`;
  chartTable.power.innerHTML = result ? result.power : "N/A";
  chartTable.power.title = result ? `Actual power rating: ${result.weightedPower}` : `${datasetType[dataset]} Power`;
  chartTable.power.parentElement.classList.remove("cell-power-fault");
  if (result && result.power != result.weightedPower) chartTable.power.parentElement.classList.add("cell-power-fault");
  output.chart.delta.power.innerHTML = powerDelta(rigs.comparison.power, rigs.target.power);

  let baseBoostVelocity = 0;
  let hyperBoostVelocity = 0;
  let stackBoostVelocity = 0;

  data.forEach((stat, i) => {
    chartRadarLabels[i] = changes.delta[i];
    chartBarsLabels[i][1] = changes.delta[i];
    chartRadar.options.scales.r.pointLabels.color[i] = changes.color[i];
    chartBars.options.scales.y.ticks.color[i] = changes.color[i];
    chartTable.parts[i].innerHTML = result ? result.rig[i].code : "-";
    chartTable.parts[i].title = result ? `${result.rig[i].name} \"${code[i]}\" \(${result.rig[i].class}\) \{${result.rig[i].power}\} \[${result.rig[i].stats}\]\n\n${result.rig[i].desc}` : `${datasetType[dataset]} ${moduleType[i]}`;
    chartTable.stats[i].innerHTML = input.option.percentageScale.checked ? (stat * scale.toPercent).toLocaleString(...statFormat) : stat;
    switch (i) {
      case 0: // Durability
        chartRangesData[dataset].maxLife.innerHTML = Math.round(evalRanges.maxLife.data[stat]).toLocaleString(...extraFormat);
        chartRangesData[dataset].autoHealSpeed.innerHTML = evalRanges.autoHealSpeed.data[stat].toLocaleString(...extraFormat);
        chartRangesData[dataset].heatDecrease.innerHTML = `${evalRanges.heatDecrease.data[stat].toLocaleString(...extraFormat)}/s`;
        chartRangesData[dataset].maxLife.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].autoHealSpeed.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].heatDecrease.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      case 1: // Thrust
        baseBoostVelocity = evalRanges.baseBoostVelocity.data[stat];
        hyperBoostVelocity = evalRanges.hyperBoostVelocity.data[stat];
        stackBoostVelocity = evalRanges.stackBoostVelocity.data[stat];
        chartForceCurvesData[dataset].baseBoost.data = evalCurves.baseBoost[stat];
        chartForceCurvesData[dataset].hyperBoost.data = evalCurves.hyperBoost[stat];
        chartForceCurvesData[dataset].stackBoost.data = evalCurves.stackBoost[stat];
        chartRangesData[dataset].heatIncrease.innerHTML = `${evalRanges.heatIncrease.data[stat].toLocaleString(...extraFormat)}/s`;
        chartRangesData[dataset].heatHyperIncrease.innerHTML = `${evalRanges.heatHyperIncrease.data[stat].toLocaleString(...extraFormat)}/s`;
        chartRangesData[dataset].heatStackIncrease.innerHTML = `${evalRanges.heatStackIncrease.data[stat].toLocaleString(...extraFormat)}/s`;
        chartRangesData[dataset].heatIncrease.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].heatHyperIncrease.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].heatStackIncrease.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      case 2: // Top Speed
        const topSpeed = getSpeeds(evalRanges.topSpeed.data[stat]);
        const flightSpeed = getSpeeds(evalRanges.flightTopSpeed.data[stat]);
        const boostSpeed = getSpeeds(Number(topSpeed.kmh) + (baseBoostVelocity * scale.toKmh))
        const hyperSpeed = getSpeeds(Number(topSpeed.kmh) + (hyperBoostVelocity * scale.toKmh))
        const stackSpeed = getSpeeds(Number(topSpeed.kmh) + (stackBoostVelocity * scale.toKmh))
        chartRangesData[dataset].topSpeed.innerHTML = `${topSpeed.kmh.toLocaleString(...extraFormat)} km/h`;
        chartRangesData[dataset].flightTopSpeed.innerHTML = `${flightSpeed.kmh.toLocaleString(...extraFormat)} km/h`;
        chartRangesData[dataset].baseBoostVelocity.innerHTML = `${boostSpeed.kmh.toLocaleString(...extraFormat)} km/h`;
        chartRangesData[dataset].hyperBoostVelocity.innerHTML = `${hyperSpeed.kmh.toLocaleString(...extraFormat)} km/h`;
        chartRangesData[dataset].stackBoostVelocity.innerHTML = `${stackSpeed.kmh.toLocaleString(...extraFormat)} km/h`;
        chartRangesData[dataset].topSpeed.title = `${topSpeed.mph.toLocaleString(...extraFormat)} mph\n\n${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].flightTopSpeed.title = `${flightSpeed.mph.toLocaleString(...extraFormat)} mph\n\n${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].baseBoostVelocity.title = `${boostSpeed.mph.toLocaleString(...extraFormat)} mph\n\n${datasetType[dataset]} ${statType[i - 1]}: ${data[i - 1]} (${(data[i - 1] * scale.toPermille).toLocaleString(...chartFormat)})\n${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].hyperBoostVelocity.title = `${hyperSpeed.mph.toLocaleString(...extraFormat)} mph\n\n${datasetType[dataset]} ${statType[i - 1]}: ${data[i - 1]} (${(data[i - 1] * scale.toPermille).toLocaleString(...chartFormat)})\n${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].stackBoostVelocity.title = `${stackSpeed.mph.toLocaleString(...extraFormat)} mph\n\n${datasetType[dataset]} ${statType[i - 1]}: ${data[i - 1]} (${(data[i - 1] * scale.toPermille).toLocaleString(...chartFormat)})\n${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      case 3: // Stability
        chartRangesData[dataset].brakePower.innerHTML = evalRanges.brakePower.data[stat].toLocaleString(...extraFormat);
        chartRangesData[dataset].gripBoostMulti.innerHTML = `${evalRanges.gripBoostMulti.data[stat].toLocaleString(...extraFormat)}x`;
        chartRangesData[dataset].brakePower.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].gripBoostMulti.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      case 4: // Steer
        chartRangesData[dataset].angSpeedBraking.innerHTML = `${evalRanges.angSpeedBraking.data[stat].toLocaleString(...extraFormat)}x`;
        chartRangesData[dataset].timeToMaxAngSpeedChg.innerHTML = `${evalRanges.timeToMaxAngSpeedChg.data[stat].toLocaleString(...extraFormat)}s`;
        chartRangesData[dataset].angSpeedBraking.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].timeToMaxAngSpeedChg.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      case 5: // Strafe
        chartRangesData[dataset].gripStrafeMulti.innerHTML = `${evalRanges.gripStrafeMulti.data[stat].toLocaleString(...extraFormat)}x`;
        chartRangesData[dataset].strafeAccel.innerHTML = `${evalRanges.strafeAccel.data[stat].toLocaleString(...extraFormat)} G`;
        chartRangesData[dataset].flightStrafeAccel.innerHTML = `${evalRanges.flightStrafeAccel.data[stat].toLocaleString(...extraFormat)} G`;
        chartRangesData[dataset].gripStrafeMulti.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].strafeAccel.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        chartRangesData[dataset].flightStrafeAccel.title = `${datasetType[dataset]} ${statType[i]}: ${stat} (${(stat * scale.toPermille).toLocaleString(...chartFormat)})`;
        break;
      default:
        break;
    }
    output.chart.delta.stats[i].classList.remove("cell-neutral", "cell-good", "cell-bad");
    output.chart.delta.stats[i].classList.add(changes.style[i]);
    output.chart.delta.stats[i].innerHTML = changes.delta[i];
  });

  chartRadar.update();
  chartBars.update();
  chartForceCurves.update();
  // chartAngleCurves.update();
}
