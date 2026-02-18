// Chart creation functions for analytics page

function createRosterSizeChart() {
  const conferenceFilter = document.getElementById('conference-filter').value;

  let teams = pitchersData.teams || [];
  if (conferenceFilter !== 'all') {
    teams = teams.filter(t => t.conference === conferenceFilter);
  }

  const teamData = teams.map(team => ({
    name: team.team || team.teamName,
    count: team.pitchers?.length || 0,
    conference: team.conference || 'Unknown'
  })).sort((a, b) => b.count - a.count).slice(0, 20);

  const ctx = document.getElementById('roster-size-chart');

  if (rosterSizeChart) {
    rosterSizeChart.destroy();
  }

  const conferenceColors = {
    'SEC': '#8b5cf6',
    'Big Ten': '#3b82f6',
    'ACC': '#ef4444',
    'Big 12': '#f59e0b',
    'Pac-12': '#10b981'
  };

  rosterSizeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: teamData.map(t => t.name),
      datasets: [{
        label: 'Number of Pitchers',
        data: teamData.map(t => t.count),
        backgroundColor: teamData.map(t => conferenceColors[t.conference] || '#94a3b8'),
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          callbacks: {
            label: (context) => `Pitchers: ${context.parsed.x}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'DM Sans' }, stepSize: 5 }
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 11 } }
        }
      }
    }
  });
}

function createPositionDistributionChart() {
  const conferenceFilter = document.getElementById('conference-filter').value;

  let teams = pitchersData.teams || [];
  if (conferenceFilter !== 'all') {
    teams = teams.filter(t => t.conference === conferenceFilter);
  }

  const positions = { 'RHP': 0, 'LHP': 0, 'P': 0, 'Unknown': 0 };

  teams.forEach(team => {
    team.pitchers?.forEach(pitcher => {
      const pos = pitcher.position || pitcher.pos || 'Unknown';
      if (positions.hasOwnProperty(pos)) {
        positions[pos]++;
      } else {
        positions['Unknown']++;
      }
    });
  });

  const ctx = document.getElementById('position-distribution-chart');

  if (positionChart) {
    positionChart.destroy();
  }

  positionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(positions),
      datasets: [{
        data: Object.values(positions),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#94a3b8'],
        borderWidth: 3,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'DM Sans', size: 13 },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function createClassYearChart() {
  const conferenceFilter = document.getElementById('conference-filter').value;

  let teams = pitchersData.teams || [];
  if (conferenceFilter !== 'all') {
    teams = teams.filter(t => t.conference === conferenceFilter);
  }

  const classYears = { 'FR': 0, 'SO': 0, 'JR': 0, 'SR': 0, 'GR': 0, 'Unknown': 0 };

  teams.forEach(team => {
    team.pitchers?.forEach(pitcher => {
      let year = pitcher.year || pitcher.class || 'Unknown';
      year = year.toUpperCase().replace(/FRESHMAN/i, 'FR').replace(/SOPHOMORE/i, 'SO')
        .replace(/JUNIOR/i, 'JR').replace(/SENIOR/i, 'SR').replace(/GRADUATE/i, 'GR')
        .replace(/R-/g, '').trim();

      if (classYears.hasOwnProperty(year)) {
        classYears[year]++;
      } else {
        classYears['Unknown']++;
      }
    });
  });

  const ctx = document.getElementById('class-year-chart');

  if (classYearChart) {
    classYearChart.destroy();
  }

  classYearChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(classYears),
      datasets: [{
        label: 'Number of Pitchers',
        data: Object.values(classYears),
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#94a3b8'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'DM Sans' }, stepSize: 50 }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 13 } }
        }
      }
    }
  });
}

function createConferenceComparisonChart() {
  const conferences = {};

  (pitchersData.teams || []).forEach(team => {
    const conf = team.conference || 'Unknown';
    if (!conferences[conf]) {
      conferences[conf] = { teams: 0, pitchers: 0 };
    }
    conferences[conf].teams++;
    conferences[conf].pitchers += team.pitchers?.length || 0;
  });

  const confData = Object.entries(conferences)
    .map(([name, data]) => ({
      name,
      avgRosterSize: data.teams > 0 ? (data.pitchers / data.teams).toFixed(1) : 0,
      totalPitchers: data.pitchers
    }))
    .sort((a, b) => b.avgRosterSize - a.avgRosterSize)
    .slice(0, 15);

  const ctx = document.getElementById('conference-comparison-chart');

  if (conferenceChart) {
    conferenceChart.destroy();
  }

  const conferenceColors = {
    'SEC': '#8b5cf6',
    'Big Ten': '#3b82f6',
    'ACC': '#ef4444',
    'Big 12': '#f59e0b',
    'Pac-12': '#10b981'
  };

  conferenceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: confData.map(c => c.name),
      datasets: [{
        label: 'Average Roster Size',
        data: confData.map(c => c.avgRosterSize),
        backgroundColor: confData.map(c => conferenceColors[c.name] || '#94a3b8'),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const conf = confData[context.dataIndex];
              return [
                `Avg Roster: ${conf.avgRosterSize}`,
                `Total Pitchers: ${conf.totalPitchers}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'DM Sans' } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 12 } }
        }
      }
    }
  });
}
