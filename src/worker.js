onmessage = (e) => {
  self.postMessage(runQuery(...e.data));
};

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

function runQuery(query, glider, parts, count) {
  let worst = 0;
  let maxDelta = 9999;
  let candidates = new Array(Math.round(query.limit / count)).fill({ id: "", delta: maxDelta }, 0, query.limit);

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

  return candidates.filter((candidate) => candidate.delta != 9999);
}
