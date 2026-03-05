let queries = {
  inputs: [],
  results: [],
  current: -1,
  searching: false,
};

function parseResult(id, delta = 0) {
  id = id.split("-");
  const glider = redoutDB.gliders.filter((glider) => glider.code === id[0]);
  const rig = [].concat(...Array.from(id[1].split(""), (char, i) => redoutDB.parts[i].details.filter((part) => part.id === char)));
  let power = glider[0].power;
  rig.forEach((part) => (power += part.power));
  const stats = addArrays([glider[0].stats, ...Array.from(rig, (part) => part.stats)]);
  return { id: id.join("-"), glider: glider[0], rig: rig, power: power, stats: stats, delta: delta };
}

function getRange(a, b) {
  let min = a < b ? a : b;
  let max = a >= b ? a : b;
  let range = new Array(Math.max(Number(max) - Number(min), 1)).fill(0);
  range = range.map((slot, i) => min + i);
  console.log(range);
  return range;
}

async function querySubmit(e, quickSearch = false) {
  let isRandom = false;
  if (e) {
    e.preventDefault();
    isRandom = e.ctrlKey;
  }

  if (queries.searching) return 0;
  queries.searching = true;

  // Indicate that we're searching by changing the UI
  input.buttons.queryIcon.classList.remove("fa-magnifying-glass");
  input.buttons.queryIcon.classList.add("fa-cog", "fa-spin");

  // Parse user input into a searchable query
  let query = {
    power: [Number(input.power.min.value), Number(input.power.max.value)],
    gliders: Array.from(document.querySelectorAll(`#select-ship input[type="checkbox"]:checked`), (ship) => Number(ship.value)),
    parts: Array.from(input.types, (type) => Array.from(document.querySelectorAll(`#${type.id} input[type="checkbox"]:checked`), (part) => Number(part.value))),
    stats: Array.from(input.targets, (target) => Number(target.value)),
    greaterOnly: input.option.greaterOnly.checked,
    limit: 120,
    selectedRig: selectedRig,
    isRatio: false,
    precision: 1,
  };

  selectedRig = { glider: [{ code: "" }], id: "" };

  // Parse the ShipGen ID (if any specified)
  let gliderCodes = Array.from(redoutDB.gliders, (glider) => glider.code);
  let idSpecified = false;
  // Shuffle mode
  if (isRandom) {
    query.gliders = getRange(getRandomInt(0, redoutDB.gliders.length - 1), getRandomInt(0, redoutDB.gliders.length - 1));
    query.parts[0] = getRange(getRandomInt(0, redoutDB.parts[0].details.length - 1), getRandomInt(0, redoutDB.parts[0].details.length - 1));
    query.parts[1] = getRange(getRandomInt(0, redoutDB.parts[1].details.length - 1), getRandomInt(0, redoutDB.parts[1].details.length - 1));
    query.parts[2] = getRange(getRandomInt(0, redoutDB.parts[2].details.length - 1), getRandomInt(0, redoutDB.parts[2].details.length - 1));
    query.parts[3] = getRange(getRandomInt(0, redoutDB.parts[3].details.length - 1), getRandomInt(0, redoutDB.parts[3].details.length - 1));
    query.parts[4] = getRange(getRandomInt(0, redoutDB.parts[4].details.length - 1), getRandomInt(0, redoutDB.parts[4].details.length - 1));
    query.parts[5] = getRange(getRandomInt(0, redoutDB.parts[5].details.length - 1), getRandomInt(0, redoutDB.parts[5].details.length - 1));
    query.stats = [getRandomInt(1, 40), getRandomInt(1, 40), getRandomInt(1, 40), getRandomInt(1, 40), getRandomInt(1, 40), getRandomInt(1, 40)];
    query.power = [175, 1150];
    quickSearch = true;
  }
  // Possible Ratio code
  if (input.id.value.includes(":", "@") && !input.id.value.includes("-") && !quickSearch) {
    let id = input.id.value.split("@");
    query.precision = id[1] ? Math.max(id[1], 1) : 1;
    let ratios = id[0].split(":").map((ratio) => Number(ratio));
    let proportions = [];
    let sum = 1;
    switch (ratios.length) {
      case 2:
        query.isRatio = true;
        proportions = ratios.concat(ratios).concat(ratios);
        sum = proportions.reduce((a, b) => a + b, 0);
        query.stats = proportions.map((proportion) => (proportion / sum).toPrecision(query.precision));
        quickSearch = true;
        break;
      case 3:
        query.isRatio = true;
        proportions = ratios.concat(ratios);
        sum = proportions.reduce((a, b) => a + b, 0);
        query.stats = proportions.map((proportion) => (proportion / sum).toPrecision(query.precision));
        quickSearch = true;
        break;
      case 6:
        query.isRatio = true;
        proportions = ratios;
        sum = proportions.reduce((a, b) => a + b, 0);
        query.stats = proportions.map((proportion) => (proportion / sum).toPrecision(query.precision));
        quickSearch = true;
        break;
      default:
        break;
    }
  }
  input.id.value.split("-").forEach((id) => {
    if (!quickSearch && id) {
      idSpecified = true;
      switch (id.length) {
        case 3:
          // Possible ship code
          let potentialGlider = gliderCodes.indexOf(id);
          if (potentialGlider != -1) query.gliders = [potentialGlider];
          break;
        case 6:
          // Possible part code, ignore power range
          [...id].forEach((idChar, i) => {
            if (partCode.includes(idChar)) {
              query.parts[i] = [partCode.indexOf(idChar)];
            }
          });
          query.power = [175, 1150];
          break;
        default:
          // Possible cheat code
          let cheats = redoutDB.cheatcodes.filter((cheat) => cheat.code.includes(id));
          if (cheats.length > 0) {
            let cheat = cheats[0];
            if (cheat.gliders.length != 0) query.gliders = cheat.gliders;
            query.parts = cheat.parts;
            query.power = [175, 1150];
          }
          break;
      }
    }
  });
  if (idSpecified) quickSearch = true;

  // Check if the current query has been searched before
  // If so: set the current query to a previous query...
  queries.current = -1;
  queries.inputs.forEach((prevQuery, i) => {
    if (JSON.stringify(query) == JSON.stringify(prevQuery)) {
      queries.current = i;
    }
  });

  let count = query.gliders.length;
  query.parts.forEach((part) => {
    count = count * part.length;
  });
  output.info.innerHTML = `Searching ${count.toLocaleString()} combinations`;
  output.info.style.setProperty("filter", "invert(0%)");
  let results;
  if (queries.current != -1) {
    // ...and reuse the results from previous query
    results = queries.results[queries.current];
    output.info.innerHTML = `Showing previous search #${queries.current + 1}`;
    console.warn(`Reusing result #${queries.current}`);
  } else {
    // Otherwise run the query and set the current query to the last in the queries array
    // If browser supports Web Workers and we're searching for more than one ship, run threaded
    // Else run on a single thread for faster results.
    results = window.Worker && query.gliders.length > 1 ? await runQueryThreaded(query, count) : await runQuery(query, count);

    // If there are results, push them to queries and save locally for reuse
    if (results) {
      results.sort(function (a, b) {
        return a.delta - b.delta;
      });
      queries.results.push(results);
      queries.inputs.push(query);
      try {
        if (!quickSearch) localStorage.setItem("lastQuery", JSON.stringify(query));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  // Parse and display them in the body of the table...
  if (results) {
    console.time("Parsing");
    let pinnedIds = Array.from(pinnedRigs, (rig) => rig.id);
    let candidates = Array.from(
      results.filter((result) => pinnedIds.indexOf(result.id) === -1),
      (result) => parseResult(result.id, result.delta),
    );
    // Sort by delta ascending
    output.headings.forEach((head) => {
      head.classList.remove("active");
      head.classList.add("asc");
    });
    candidates.sort(function (a, b) {
      return a.delta - b.delta;
    });
    output.table.innerHTML = parseResults(pinnedRigs.concat(candidates), query);
    console.timeEnd("Parsing");
  }

  // Indicate to the user that the search is finished by changing back the UI
  queries.searching = false;
  input.buttons.queryIcon.classList.remove("fa-cog", "fa-spin");
  input.buttons.queryIcon.classList.add("fa-magnifying-glass");
}

function addArrays(arrays) {
  const numArrays = arrays.length;
  const arrayLength = arrays[0].length;
  const result = new Array(arrayLength).fill(0);

  for (let i = 0; i < numArrays; i++) {
    for (let j = 0; j < arrayLength; j++) {
      result[j] += arrays[i][j];
    }
  }

  // Prevent negative arrays
  for (let j = 0; j < arrayLength; j++) {
    result[j] = Math.max(0, result[j]);
  }

  return result;
}

function calculateDelta(candidate, query, greaterOnly = false) {
  let delta = 0;

  for (let i = 0; i < candidate.length; i++) {
    // Skip targets with 0 value
    if (query[i] != 0) {
      if (greaterOnly && candidate[i] < query[i]) return 9999;
      delta += Math.abs(candidate[i] - query[i]);
    }
  }

  return delta;
}

async function runQuery(query, count) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.time("Query");

      // Get detailed info of query from RedoutDB
      let gliders = Array.from(query.gliders, (glider) => redoutDB.gliders[glider]);
      let parts = Array.from(query.parts, (type, i) => Array.from(type, (part) => redoutDB.parts[i].details[part]));

      let worst = 0;
      let maxDelta = 9999;
      let candidates = new Array(query.limit).fill({ id: "", delta: maxDelta }, 0, query.limit);

      gliders.forEach((glider) => {
        parts[0].forEach((propulsor) => {
          parts[1].forEach((stabilizer) => {
            parts[2].forEach((rudder) => {
              parts[3].forEach((hull) => {
                parts[4].forEach((intercooler) => {
                  parts[5].forEach((esc) => {
                    const rig = [propulsor, stabilizer, rudder, hull, intercooler, esc];
                    let power = glider.power;
                    rig.forEach((part) => (power += part.power));
                    if (query.power[0] <= power && power <= query.power[1]) {
                      const stats = addArrays([glider.stats, ...Array.from(rig, (part) => part.stats)]);
                      // Ratio mode
                      if (query.isRatio) {
                        sum = stats.reduce((a, b) => a + b, 0);
                        ratios = stats.map((stat) => (stat / sum).toPrecision(query.precision));
                        let isBalanced = ratios.join() == query.stats.join();

                        if (isBalanced) {
                          maxDelta = 0;
                          const candidate = {
                            id: `${glider.code}-${Array.from(rig, (part) => part.id).join("")}`,
                            delta: sum,
                          };
                          candidates[worst] = candidate;
                          candidates.forEach((candidate, i) => {
                            if (candidate.delta > maxDelta) {
                              maxDelta = candidate.delta;
                              worst = i;
                            }
                          });
                        }
                      }
                      // Normal mode
                      else {
                        const delta = calculateDelta(stats, query.stats, query.greaterOnly);
                        if (delta <= maxDelta) {
                          maxDelta = 0;
                          const candidate = {
                            id: `${glider.code}-${Array.from(rig, (part) => part.id).join("")}`,
                            delta: delta,
                          };
                          candidates[worst] = candidate;
                          candidates.forEach((candidate, i) => {
                            if (candidate.delta > maxDelta) {
                              maxDelta = candidate.delta;
                              worst = i;
                            }
                          });
                        }
                      }
                    }
                  });
                });
              });
            });
          });
        });
      });

      const mergedResults = candidates.filter((candidate) => candidate.delta != 9999);
      console.timeEnd("Query");
      console.warn(`Searched ${count.toLocaleString()} combinations on a single thread!`);
      if (mergedResults.length === 0) {
        reject("No results found!");
        output.info.innerHTML = "No results found!";
        output.info.style.setProperty("filter", "invert(100%)");
      } else {
        console.info(`Showing top ${mergedResults.length} result(s)`);
        output.info.innerHTML = `Searched ${count.toLocaleString()} combinations`;
        output.info.style.setProperty("filter", "invert(0%)");
        resolve(mergedResults);
      }
    }, 0);
  }).catch((e) => {
    console.warn(e);
  });
}

async function runQueryThreaded(query, count) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.time("Query");

      let workers = {
        count: query.gliders.length,
        results: [],
        done: 0,
      };

      // Get detailed info of query from RedoutDB
      let gliders = Array.from(query.gliders, (glider) => redoutDB.gliders[glider]);
      let parts = Array.from(query.parts, (type, i) => Array.from(type, (part) => redoutDB.parts[i].details[part]));

      gliders.forEach((glider) => {
        let arrayWorker = new Worker("./src/worker.js");
        arrayWorker.postMessage([query, glider, parts, workers.count]);
        arrayWorker.onmessage = (e) => {
          workers.results.push(e.data);
          workers.done++;
          if (workers.done === workers.count) {
            const mergedResults = [].concat(...workers.results);

            console.timeEnd("Query");
            console.info(`Searched ${count.toLocaleString()} combinations with ${workers.count} thread(s)`);
            if (mergedResults.length === 0) {
              reject("No results found!");
              output.info.innerHTML = "No results found!";
              output.info.style.setProperty("filter", "invert(100%)");
            } else {
              console.info(`Showing top ${mergedResults.length} result(s)`);
              output.info.innerHTML = `Searched ${count.toLocaleString()} combinations`;
              output.info.style.setProperty("filter", "invert(0%)");
              resolve(mergedResults);
            }
          }
          arrayWorker.terminate();
        };
      });
    }, 0);
  }).catch((e) => {
    console.warn(e);
  });
}

function parseResults(candidates, query) {
  let html = "";
  let pinnedIds = Array.from(pinnedRigs, (rig) => rig.id);
  candidates.forEach((candidate) => {
    html += `<tr class='${selectedRig.id === candidate.id && "selected"} ${query.selectedRig.id === candidate.id && "targeted"} ${pinnedIds.indexOf(candidate.id) !== -1 && "pinned"}' onmouseover='rowHover(event, this)' onclick='rowClick(event, this)' title='${candidate.id}'><td onclick='idClick(event, this)' class='results-cell-bottom results-cell-right cell-ship' title="${candidate.glider.name} (${candidate.glider.code}) {${candidate.glider.power}} [${candidate.glider.stats}]\n\n${candidate.glider.desc}"><img src='./img/${candidate.glider.code}.webp'></img><span>${candidate.id}</span></td>`;
    candidate.rig.forEach((part) => {
      html += `<td class='results-cell-bottom cell-class-${part.class}' title="${part.name} (${part.class}) {${part.power}} [${part.stats}]\n\n${part.desc}">${part.code}</td>`;
    });
    html += `<td class='results-cell-bottom results-cell-left results-cell-right cell-power'><span>${candidate.power}</span></td>`;
    candidate.stats.forEach((stat, i) => {
      let statType = "";
      if (stat > query.stats[i] * 1.1) {
        statType = "cell-good";
      } else if (stat < query.stats[i] * 0.9) {
        statType = "cell-bad";
      }
      // Top Speed tooltip
      let statEstimation = "";
      if (i === 2) {
        statEstimation = `\n\n${redoutDB.graphs.speed[stat]} km/h (${Math.round(redoutDB.graphs.speed[stat] / 1.609344)} mph)`;
      }
      let delta = stat - query.stats[i];
      let deltaPercentage = (delta / 40).toLocaleString(...deltaFormat);
      let statPercentage = ((100 * stat) / 40).toLocaleString(...statFormat);
      html += `<td class='results-cell-bottom ${statType}' title='${chartLabels[i]}: ${stat} (${statPercentage}%)\nStat change: ${delta} (${deltaPercentage})${statEstimation}\nTotal change: ${candidate.delta}'>${input.option.percentageScale.checked ? statPercentage : stat}</td>`;
    });
    html += `</tr>`;
  });
  return html;
}
