let extractedData = null;
let downloadedCount = 0;

const statusEl = document.getElementById('status');
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const exportBtn = document.getElementById('exportBtn');
const pitcherListEl = document.getElementById('pitcherList');
const progressEl = document.getElementById('progress');

// Extract data from the page
extractBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Extracting data...';
  statusEl.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'extractData' }, (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = 'Error: Make sure you\'re on a roster page';
        statusEl.className = 'status error';
        return;
      }

      if (response.error) {
        statusEl.textContent = response.error;
        statusEl.className = 'status error';
        return;
      }

      extractedData = response;

      const withHeadshots = extractedData.pitchers.filter(p => p.headshotUrl).length;

      statusEl.textContent = `Found ${extractedData.pitchers.length} pitchers (${withHeadshots} with headshots) for ${extractedData.team.name}`;
      statusEl.className = 'status success';

      downloadBtn.disabled = withHeadshots === 0;
      exportBtn.disabled = false;

      // Display pitcher list
      pitcherListEl.innerHTML = extractedData.pitchers.map(p => `
        <div class="pitcher-item">
          <div>
            <div class="pitcher-name">${p.name}</div>
            <div class="pitcher-meta">${p.position} ${p.number ? '#' + p.number : ''} ${p.year || ''}</div>
          </div>
          <div class="${p.headshotUrl ? 'has-headshot' : 'no-headshot'}">
            ${p.headshotUrl ? '✓' : '✗'}
          </div>
        </div>
      `).join('');
    });
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = 'status error';
  }
});

// Download all headshots
downloadBtn.addEventListener('click', async () => {
  if (!extractedData) return;

  downloadBtn.disabled = true;
  downloadedCount = 0;

  const pitchersWithHeadshots = extractedData.pitchers.filter(p => p.headshotUrl);
  const total = pitchersWithHeadshots.length;

  progressEl.style.display = 'block';
  progressEl.textContent = `Downloading 0/${total}...`;

  for (let i = 0; i < pitchersWithHeadshots.length; i++) {
    const pitcher = pitchersWithHeadshots[i];
    const filename = `${extractedData.team.slug}_${extractedData.team.id}-P${i + 1}.jpg`;

    try {
      // Use Chrome's download API (uses browser's session/cookies)
      await chrome.downloads.download({
        url: pitcher.headshotUrl,
        filename: `cbb-headshots/${filename}`,
        saveAs: false
      });

      downloadedCount++;
      progressEl.textContent = `Downloaded ${downloadedCount}/${total}...`;

      // Add filename to pitcher data
      pitcher.headshotFile = filename;

      // Wait between downloads to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Failed to download ${pitcher.name}:`, error);
    }
  }

  statusEl.textContent = `Downloaded ${downloadedCount} of ${total} headshots`;
  statusEl.className = downloadedCount === total ? 'status success' : 'status';

  downloadBtn.disabled = false;
  exportBtn.disabled = false;

  progressEl.textContent = 'Download complete!';
});

// Export manifest
exportBtn.addEventListener('click', () => {
  if (!extractedData) return;

  const manifest = {
    created: new Date().toISOString(),
    total_downloaded: downloadedCount,
    total_pitchers: extractedData.pitchers.length,
    team: extractedData.team,
    pitchers: extractedData.pitchers
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: `cbb-headshots/${extractedData.team.slug}_manifest.json`,
    saveAs: false
  });

  statusEl.textContent = 'Manifest exported! Check your Downloads/cbb-headshots folder';
  statusEl.className = 'status success';
});
