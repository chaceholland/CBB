// Content script - runs on roster pages
console.log('College Baseball Headshot Scraper loaded');

// Detect team from URL
function detectTeam() {
  const url = window.location.hostname;

  if (url.includes('12thman.com')) {
    return { id: '123', name: 'Texas A&M', slug: 'texas-am' };
  } else if (url.includes('texassports.com') || url.includes('texaslonghorns.com')) {
    return { id: '126', name: 'Texas', slug: 'texas' };
  } else if (url.includes('scarletknights.com')) {
    return { id: '102', name: 'Rutgers', slug: 'rutgers' };
  }

  return null;
}

// Extract pitcher data from the page
function extractPitchers() {
  const results = [];
  const seen = new Set();

  const addPitcher = (name, number, position, year, headshotUrl) => {
    const cleanName = name?.trim().replace(/\s+/g, ' ');
    if (!cleanName || cleanName.length < 2 || seen.has(cleanName)) return;
    seen.add(cleanName);

    let pos = (position || '').toUpperCase();
    if (!pos.includes('RHP') && !pos.includes('LHP') && !pos.includes('PITCHER') &&
        !pos.includes('P/') && !pos.includes('/P') && pos !== 'P') return;

    if (pos.includes('LEFT') || pos.includes('LHP')) pos = 'LHP';
    else if (pos.includes('RIGHT') || pos.includes('RHP')) pos = 'RHP';
    else pos = 'P';

    results.push({
      name: cleanName,
      number: (number || '').replace('#', '').trim(),
      position: pos,
      year: (year || '').trim(),
      headshotUrl: headshotUrl || ''
    });
  };

  // SIDEARM cards
  document.querySelectorAll('.s-person-card, [class*="s-person"]').forEach(card => {
    const posText = card.textContent || '';
    if (posText.match(/RHP|LHP|Pitcher/i)) {
      const nameEl = card.querySelector('[class*="name"] a, [class*="name"], h3, h4');
      const numEl = card.querySelector('[class*="number"], [class*="jersey"]');
      const yearEl = card.querySelector('[class*="year"], [class*="class"]');
      const imgEl = card.querySelector('img');
      const posMatch = posText.match(/(RHP|LHP|Pitcher)/i);
      addPitcher(nameEl?.textContent, numEl?.textContent, posMatch?.[1], yearEl?.textContent, imgEl?.src);
    }
  });

  // Table rows
  document.querySelectorAll('table tr').forEach(row => {
    const rowText = row.textContent || '';
    if (rowText.match(/RHP|LHP|Pitcher/i)) {
      const nameLink = row.querySelector('a[href*="roster"], a[href*="bio"]');
      const posMatch = rowText.match(/(RHP|LHP|Pitcher)/i);
      const cells = Array.from(row.querySelectorAll('td, th'));
      const numCell = cells.find(c => c.textContent.match(/^\s*\d{1,2}\s*$/));
      const yearCell = cells.find(c => c.textContent.match(/Fr\.|So\.|Jr\.|Sr\./i));
      const img = row.querySelector('img');
      if (nameLink) {
        addPitcher(nameLink.textContent, numCell?.textContent, posMatch?.[1], yearCell?.textContent, img?.src);
      }
    }
  });

  return results;
}

// Extract all image URLs from page source
function extractImageUrls() {
  const pageSource = document.documentElement.outerHTML;
  const headshotRegex = /https:\/\/[^"'\s]+\.(jpg|png)/g;
  const allUrls = [...pageSource.matchAll(headshotRegex)].map(m => m[0]);

  const headshotUrls = allUrls.filter(url =>
    (url.includes('wp-content/uploads') ||
     url.includes('images') ||
     url.includes('headshot') ||
     url.includes('roster') ||
     url.includes('player') ||
     url.includes('sidearmdev.com') ||
     url.includes('sidearmsports.com')) &&
    !url.includes('logo') &&
    !url.includes('icon')
  );

  return [...new Set(headshotUrls)];
}

// Match pitchers with headshot URLs
function matchHeadshots(pitchers, headshotUrls) {
  pitchers.forEach(pitcher => {
    const nameParts = pitcher.name.split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];

    const patterns = [
      `${lastName}${firstName}`,
      `${firstName}${lastName}`,
      `${lastName}-${firstName}`,
      `${firstName}-${lastName}`,
      lastName,
      firstName
    ];

    for (const pattern of patterns) {
      const matchingUrl = headshotUrls.find(url =>
        url.toLowerCase().includes(pattern.toLowerCase())
      );
      if (matchingUrl) {
        pitcher.headshotUrl = matchingUrl;
        break;
      }
    }
  });

  return pitchers;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    const team = detectTeam();

    if (!team) {
      sendResponse({ error: 'Not on a supported roster page' });
      return;
    }

    const pitchers = extractPitchers();
    const headshotUrls = extractImageUrls();
    const pitchersWithHeadshots = matchHeadshots(pitchers, headshotUrls);

    sendResponse({
      team: team,
      pitchers: pitchersWithHeadshots,
      totalHeadshots: headshotUrls.length
    });
  }

  return true; // Will respond asynchronously
});

// Add a visual indicator that the extension is active
const indicator = document.createElement('div');
indicator.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: #10b981;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: sans-serif;
  font-size: 12px;
  z-index: 10000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
`;
indicator.textContent = '⚾ Scraper Ready';
document.body.appendChild(indicator);

setTimeout(() => {
  indicator.remove();
}, 3000);
