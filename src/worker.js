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

function runQuery(worker, query, gliders, parts, limit, count) {
  console.time(`Thread ${worker}`);
  let worst = 0;
  let maxDelta = 9999;
  let candidates = new Array(limit).fill({ id: "", delta: maxDelta }, 0, limit);

  // 0 = power, 1 = stats, 2 = id
  let i = 0;
  gliders.forEach((glider) => {
    parts[0].forEach((propulsor) => {
      parts[1].forEach((stabilizer) => {
        parts[2].forEach((rudder) => {
          parts[3].forEach((hull) => {
            parts[4].forEach((intercooler) => {
              parts[5].forEach((esc) => {
                if (!(i ^ worker)) {
                  const rig = [propulsor, stabilizer, rudder, hull, intercooler, esc];
                  let power = glider[0];
                  rig.forEach((part) => (power += part[0]));
                  if (query.power[0] <= power && power <= query.power[1]) {
                    const stats = addArrays([glider[1], ...Array.from(rig, (part) => part[1])]);
                    let delta = 0;
                    // Ratio mode or Stat mode
                    if (query.ratios) {
                      let sum = stats.reduce((a, b) => a + b, 0);
                      let ratios = stats.map((stat) => ((stat / sum) * 1000) | 0);
                      delta = calculateDelta(ratios, query.ratios, query.greaterOnly);
                    } else {
                      delta = calculateDelta(stats, query.stats, query.greaterOnly);
                    }
                    if (delta <= maxDelta) {
                      maxDelta = 0;
                      const candidate = {
                        id: `${glider[2]}-${Array.from(rig, (part) => part[2]).join("")}`,
                        power: power,
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
                i++; if (i >= count) i = 0;
              });
            });
          });
        });
      });
    });
  });
  console.timeEnd(`Thread ${worker}`);

  return candidates.filter((candidate) => candidate.delta != 9999);
}
