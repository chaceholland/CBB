import fs from 'fs-extra';
import path from 'path';

/**
 * Print console summary of comparison results
 * @param {Object} comparisonReport - The comparison report object
 * @param {Array} failedTeams - Array of teams that failed to scrape
 */
export function printConsoleSummary(comparisonReport, failedTeams = []) {
  console.log('\n=== VERIFICATION SUMMARY ===\n');

  // Count teams
  const totalTeams = Object.keys(comparisonReport).length;
  const teamsWithChanges = Object.values(comparisonReport).filter(
    team => team.changes.additions.length > 0 ||
            team.changes.removals.length > 0 ||
            team.changes.modifications.length > 0
  ).length;
  const unchangedTeams = totalTeams - teamsWithChanges;

  console.log(`Total Teams Verified: ${totalTeams}`);
  console.log(`Teams with Changes: ${teamsWithChanges}`);
  console.log(`Unchanged Teams: ${unchangedTeams}`);
  console.log(`Failed Teams: ${failedTeams.length}`);

  // Count changes
  let totalAdditions = 0;
  let totalRemovals = 0;
  let totalModifications = 0;

  for (const team of Object.values(comparisonReport)) {
    totalAdditions += team.changes.additions.length;
    totalRemovals += team.changes.removals.length;
    totalModifications += team.changes.modifications.length;
  }

  console.log('\n=== CHANGE BREAKDOWN ===\n');
  console.log(`➕ Additions: ${totalAdditions}`);
  console.log(`➖ Removals: ${totalRemovals}`);
  console.log(`✏️  Modifications: ${totalModifications}`);
  console.log(`📊 Total Changes: ${totalAdditions + totalRemovals + totalModifications}`);

  if (failedTeams.length > 0) {
    console.log('\n=== FAILED TEAMS ===\n');
    failedTeams.forEach(team => {
      console.log(`❌ ${team.team} (${team.conference})`);
      console.log(`   Error: ${team.error}`);
    });
  }

  console.log('\n');
}

/**
 * Print detailed changes for each team
 * @param {Object} comparisonReport - The comparison report object
 */
export function printDetailedChanges(comparisonReport) {
  console.log('\n=== DETAILED CHANGES ===\n');

  const teamsWithChanges = Object.entries(comparisonReport).filter(
    ([_, team]) => team.changes.additions.length > 0 ||
                   team.changes.removals.length > 0 ||
                   team.changes.modifications.length > 0
  );

  if (teamsWithChanges.length === 0) {
    console.log('No changes detected.\n');
    return;
  }

  for (const [teamName, teamData] of teamsWithChanges) {
    console.log(`\n${teamName} (${teamData.conference})`);
    console.log('─'.repeat(60));

    // Additions
    if (teamData.changes.additions.length > 0) {
      console.log('\n➕ ADDITIONS:');
      teamData.changes.additions.forEach(player => {
        console.log(`  + ${player.name} (#${player.jersey}) - ${player.position}`);
        console.log(`    ${player.height} | ${player.weight} | ${player.year}`);
      });
    }

    // Removals
    if (teamData.changes.removals.length > 0) {
      console.log('\n➖ REMOVALS:');
      teamData.changes.removals.forEach(player => {
        console.log(`  - ${player.name} (#${player.jersey}) - ${player.position}`);
        console.log(`    ${player.height} | ${player.weight} | ${player.year}`);
      });
    }

    // Modifications
    if (teamData.changes.modifications.length > 0) {
      console.log('\n✏️  MODIFICATIONS:');
      teamData.changes.modifications.forEach(mod => {
        console.log(`  ~ ${mod.name} (#${mod.jersey})`);
        if (mod.differences.position) {
          console.log(`    Position: ${mod.differences.position.old} → ${mod.differences.position.new}`);
        }
        if (mod.differences.height) {
          console.log(`    Height: ${mod.differences.height.old} → ${mod.differences.height.new}`);
        }
        if (mod.differences.weight) {
          console.log(`    Weight: ${mod.differences.weight.old} → ${mod.differences.weight.new}`);
        }
        if (mod.differences.year) {
          console.log(`    Year: ${mod.differences.year.old} → ${mod.differences.year.new}`);
        }
        if (mod.differences.hometown) {
          console.log(`    Hometown: ${mod.differences.hometown.old} → ${mod.differences.hometown.new}`);
        }
      });
    }

    console.log('');
  }
}

/**
 * Save comparison report to JSON file
 * @param {Object} comparisonReport - The comparison report object
 * @param {Array} failedTeams - Array of teams that failed to scrape
 */
export async function saveJsonReport(comparisonReport, failedTeams = []) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `verification-report-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'data', filename);

  // Ensure data directory exists
  await fs.ensureDir(path.join(process.cwd(), 'data'));

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTeams: Object.keys(comparisonReport).length,
      teamsWithChanges: Object.values(comparisonReport).filter(
        team => team.changes.additions.length > 0 ||
                team.changes.removals.length > 0 ||
                team.changes.modifications.length > 0
      ).length,
      failedTeams: failedTeams.length
    },
    teams: comparisonReport,
    failures: failedTeams
  };

  await fs.writeJson(filepath, report, { spaces: 2 });
  console.log(`\n📝 Report saved to: ${filepath}\n`);
}

/**
 * Save failed teams to JSON file
 * @param {Array} failedTeams - Array of teams that failed to scrape
 */
export async function saveFailedTeams(failedTeams) {
  if (failedTeams.length === 0) {
    return;
  }

  const filepath = path.join(process.cwd(), 'data', 'failed_teams.json');

  // Ensure data directory exists
  await fs.ensureDir(path.join(process.cwd(), 'data'));

  await fs.writeJson(filepath, failedTeams, { spaces: 2 });
  console.log(`❌ Failed teams saved to: ${filepath}\n`);
}
