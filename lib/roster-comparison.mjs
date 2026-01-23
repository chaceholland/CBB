/**
 * Roster Comparison Module
 * Compares ESPN roster data with existing roster data to detect changes
 */

/**
 * Classify the importance of a change
 * @param {string} changeType - Type of change
 * @param {Object} details - Change details
 * @returns {string} - 'critical', 'important', or 'minor'
 */
function classifyChange(changeType, details) {
  // Critical changes - pitcher position changes
  if (changeType === 'position_change') {
    const wasPitcher = details.old === 'P' || details.old === 'RHP' || details.old === 'LHP';
    const isPitcher = details.new === 'P' || details.new === 'RHP' || details.new === 'LHP';
    if (wasPitcher !== isPitcher) {
      return 'critical';
    }
  }

  // Important changes
  const importantChanges = [
    'player_added',
    'player_removed',
    'position_change',
    'year_change'
  ];

  if (importantChanges.includes(changeType)) {
    // New/removed pitchers are important
    if (changeType === 'player_added' || changeType === 'player_removed') {
      const position = details.position || details.old?.position;
      if (position === 'P' || position === 'RHP' || position === 'LHP') {
        return 'important';
      }
    }
    return 'important';
  }

  // Everything else is minor
  return 'minor';
}

/**
 * Compare two player objects
 * @param {Object} espnPlayer - Player from ESPN
 * @param {Object} existingPlayer - Player from existing data
 * @returns {Array} - Array of change objects
 */
function comparePlayer(espnPlayer, existingPlayer) {
  const changes = [];

  // Compare position
  if (espnPlayer.position !== existingPlayer.position) {
    const change = {
      type: 'position_change',
      field: 'position',
      old: existingPlayer.position,
      new: espnPlayer.position
    };
    change.importance = classifyChange('position_change', { old: existingPlayer.position, new: espnPlayer.position });
    changes.push(change);
  }

  // Compare year
  if (espnPlayer.year !== existingPlayer.year) {
    const change = {
      type: 'year_change',
      field: 'year',
      old: existingPlayer.year,
      new: espnPlayer.year
    };
    change.importance = classifyChange('year_change', {});
    changes.push(change);
  }

  // Compare number
  if (espnPlayer.number !== existingPlayer.number) {
    const change = {
      type: 'number_change',
      field: 'number',
      old: existingPlayer.number,
      new: espnPlayer.number
    };
    change.importance = classifyChange('number_change', {});
    changes.push(change);
  }

  // Compare bio fields
  const bioFields = ['height', 'weight', 'hometown'];
  for (const field of bioFields) {
    if (espnPlayer[field] !== existingPlayer[field]) {
      changes.push({
        type: 'bio_update',
        field: field,
        old: existingPlayer[field],
        new: espnPlayer[field],
        importance: 'minor'
      });
    }
  }

  return changes;
}

/**
 * Compare rosters for a single team
 * @param {Array} espnRoster - Roster from ESPN
 * @param {Array} existingRoster - Roster from existing data
 * @returns {Object} - Comparison results with changes categorized by importance
 */
export function compareRosters(espnRoster, existingRoster) {
  const results = {
    critical: [],
    important: [],
    minor: [],
    summary: {
      playersAdded: 0,
      playersRemoved: 0,
      playersChanged: 0,
      totalChanges: 0
    }
  };

  // Create lookup maps by name
  const espnMap = new Map();
  const existingMap = new Map();

  // Normalize names and create maps
  espnRoster.forEach(player => {
    const key = `${player.firstName}|${player.lastName}`.toLowerCase();
    espnMap.set(key, player);
  });

  existingRoster.forEach(player => {
    const key = `${player.firstName}|${player.lastName}`.toLowerCase();
    existingMap.set(key, player);
  });

  // Find added players (in ESPN but not in existing)
  for (const [key, espnPlayer] of espnMap) {
    if (!existingMap.has(key)) {
      const change = {
        type: 'player_added',
        player: {
          name: `${espnPlayer.firstName} ${espnPlayer.lastName}`,
          position: espnPlayer.position,
          year: espnPlayer.year,
          number: espnPlayer.number
        }
      };
      change.importance = classifyChange('player_added', { position: espnPlayer.position });

      if (change.importance === 'critical') {
        results.critical.push(change);
      } else if (change.importance === 'important') {
        results.important.push(change);
      } else {
        results.minor.push(change);
      }

      results.summary.playersAdded++;
    }
  }

  // Find removed players (in existing but not in ESPN)
  for (const [key, existingPlayer] of existingMap) {
    if (!espnMap.has(key)) {
      const change = {
        type: 'player_removed',
        player: {
          name: `${existingPlayer.firstName} ${existingPlayer.lastName}`,
          position: existingPlayer.position,
          year: existingPlayer.year,
          number: existingPlayer.number
        }
      };
      change.importance = classifyChange('player_removed', { position: existingPlayer.position });

      if (change.importance === 'critical') {
        results.critical.push(change);
      } else if (change.importance === 'important') {
        results.important.push(change);
      } else {
        results.minor.push(change);
      }

      results.summary.playersRemoved++;
    }
  }

  // Find changed players (in both)
  for (const [key, espnPlayer] of espnMap) {
    if (existingMap.has(key)) {
      const existingPlayer = existingMap.get(key);
      const playerChanges = comparePlayer(espnPlayer, existingPlayer);

      if (playerChanges.length > 0) {
        results.summary.playersChanged++;

        // Add each change to appropriate category
        playerChanges.forEach(change => {
          const changeWithPlayer = {
            ...change,
            player: {
              name: `${espnPlayer.firstName} ${espnPlayer.lastName}`,
              position: espnPlayer.position,
              year: espnPlayer.year,
              number: espnPlayer.number
            }
          };

          if (change.importance === 'critical') {
            results.critical.push(changeWithPlayer);
          } else if (change.importance === 'important') {
            results.important.push(changeWithPlayer);
          } else {
            results.minor.push(changeWithPlayer);
          }
        });
      }
    }
  }

  // Calculate total changes
  results.summary.totalChanges =
    results.critical.length +
    results.important.length +
    results.minor.length;

  return results;
}

/**
 * Compare rosters for all teams
 * @param {Object} espnData - All ESPN roster data (keyed by team)
 * @param {Object} existingData - All existing roster data (keyed by team)
 * @returns {Object} - Comparison results for all teams
 */
export function compareAllRosters(espnData, existingData) {
  const allResults = {};
  const globalSummary = {
    teamsWithChanges: 0,
    totalCritical: 0,
    totalImportant: 0,
    totalMinor: 0,
    totalChanges: 0
  };

  // Get all team keys from both datasets
  const allTeams = new Set([
    ...Object.keys(espnData),
    ...Object.keys(existingData)
  ]);

  for (const team of allTeams) {
    const espnRoster = espnData[team] || [];
    const existingRoster = existingData[team] || [];

    const teamResults = compareRosters(espnRoster, existingRoster);

    if (teamResults.summary.totalChanges > 0) {
      allResults[team] = teamResults;
      globalSummary.teamsWithChanges++;
      globalSummary.totalCritical += teamResults.critical.length;
      globalSummary.totalImportant += teamResults.important.length;
      globalSummary.totalMinor += teamResults.minor.length;
      globalSummary.totalChanges += teamResults.summary.totalChanges;
    }
  }

  return {
    teams: allResults,
    summary: globalSummary
  };
}
