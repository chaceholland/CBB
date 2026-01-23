/**
 * Comprehensive Athletic Website URLs for Major Conferences
 * Manually curated based on known SIDEARM platform patterns
 */

const ATHLETIC_WEBSITES = {
  // SEC (16 teams)
  '333': { base: 'https://rolltide.com', roster: '/sports/baseball/roster' }, // Alabama
  '8': { base: 'https://arkansasrazorbacks.com', roster: '/sports/baseball/roster' }, // Arkansas
  '2': { base: 'https://auburntigers.com', roster: '/sports/baseball/roster' }, // Auburn
  '57': { base: 'https://floridagators.com', roster: '/sports/baseball/roster' }, // Florida
  '61': { base: 'https://georgiadogs.com', roster: '/sports/baseball/roster' }, // Georgia
  '96': { base: 'https://ukathletics.com', roster: '/sports/baseball/roster' }, // Kentucky
  '99': { base: 'https://lsusports.net', roster: '/sports/baseball/roster' }, // LSU
  '344': { base: 'https://hailstate.com', roster: '/sports/baseball/roster' }, // Mississippi State
  '142': { base: 'https://mutigers.com', roster: '/sports/baseball/roster' }, // Missouri
  '201': { base: 'https://soonersports.com', roster: '/sports/baseball/roster' }, // Oklahoma
  '145': { base: 'https://olemisssports.com', roster: '/sports/baseball/roster' }, // Ole Miss
  '2579': { base: 'https://gamecocksonline.com', roster: '/sports/baseball/roster' }, // South Carolina
  '2633': { base: 'https://utsports.com', roster: '/sports/baseball/roster' }, // Tennessee
  '251': { base: 'https://texaslonghorns.com', roster: '/sports/baseball/roster' }, // Texas
  '245': { base: 'https://12thman.com', roster: '/sports/baseball/roster' }, // Texas A&M
  '238': { base: 'https://vucommodores.com', roster: '/sports/baseball/roster' }, // Vanderbilt
  
  // ACC (17 teams)
  '103': { base: 'https://bceagles.com', roster: '/sports/baseball/roster' }, // Boston College
  '228': { base: 'https://clemsontigers.com', roster: '/sports/baseball/roster' }, // Clemson
  '93': { base: 'https://goduke.com', roster: '/sports/baseball/roster' }, // Duke
  '52': { base: 'https://seminoles.com', roster: '/sports/baseball/roster' }, // Florida State
  '59': { base: 'https://ramblinwreck.com', roster: '/sports/baseball/roster' }, // Georgia Tech
  '97': { base: 'https://uoflsports.com', roster: '/sports/baseball/roster' }, // Louisville
  '153': { base: 'https://theacc.com', roster: '/sports/baseball/roster' }, // Miami
  '152': { base: 'https://goheels.com', roster: '/sports/baseball/roster' }, // North Carolina
  '152': { base: 'https://gopack.com', roster: '/sports/baseball/roster' }, // NC State
  '513': { base: 'https://ndsports.com', roster: '/sports/baseball/roster' }, // Notre Dame
  '221': { base: 'https://pittsburghpanthers.com', roster: '/sports/baseball/roster' }, // Pittsburgh
  '64': { base: 'https://gostanford.com', roster: '/sports/baseball/roster' }, // Stanford
  '120': { base: 'https://cuse.com', roster: '/sports/baseball/roster' }, // Syracuse
  '259': { base: 'https://virginiasports.com', roster: '/sports/baseball/roster' }, // Virginia
  '154': { base: 'https://hokiesports.com', roster: '/sports/baseball/roster' }, // Virginia Tech
  '235': { base: 'https://godukemdeacs.com', roster: '/sports/baseball/roster' }, // Wake Forest
  '52': { base: 'https://calbears.com', roster: '/sports/baseball/roster' }, // California
  
  // Big 12 (14 teams)
  '9': { base: 'https://arizonaathletics.com', roster: '/sports/baseball/roster' }, // Arizona
  '9': { base: 'https://thesundevils.com', roster: '/sports/baseball/roster' }, // Arizona State
  '239': { base: 'https://baylorbears.com', roster: '/sports/baseball/roster' }, // Baylor
  '236': { base: 'https://byu.edu', roster: '/sports/baseball/roster' }, // BYU
  '38': { base: 'https://gobearcats.com', roster: '/sports/baseball/roster' }, // Cincinnati
  '66': { base: 'https://cubuffs.com', roster: '/sports/baseball/roster' }, // Colorado
  '248': { base: 'https://uhcougars.com', roster: '/sports/baseball/roster' }, // Houston
  '2305': { base: 'https://cyclones.com', roster: '/sports/baseball/roster' }, // Iowa State
  '2305': { base: 'https://kuathletics.com', roster: '/sports/baseball/roster' }, // Kansas
  '2305': { base: 'https://kstatesports.com', roster: '/sports/baseball/roster' }, // Kansas State
  '197': { base: 'https://okstate.com', roster: '/sports/baseball/roster' }, // Oklahoma State
  '251': { base: 'https://gofrogs.com', roster: '/sports/baseball/roster' }, // TCU
  '251': { base: 'https://texastech.com', roster: '/sports/baseball/roster' }, // Texas Tech
  '277': { base: 'https://gowvu.com', roster: '/sports/baseball/roster' }, // West Virginia
  
  // Big Ten (14 teams - not all have baseball)
  '356': { base: 'https://fightingillini.com', roster: '/sports/baseball/roster' }, // Illinois
  '84': { base: 'https://hawkeyesports.com', roster: '/sports/baseball/roster' }, // Iowa
  '135': { base: 'https://umterps.com', roster: '/sports/baseball/roster' }, // Maryland
  '130': { base: 'https://mgoblue.com', roster: '/sports/baseball/roster' }, // Michigan
  '127': { base: 'https://msuspartans.com', roster: '/sports/baseball/roster' }, // Michigan State
  '135': { base: 'https://gophersports.com', roster: '/sports/baseball/roster' }, // Minnesota
  '158': { base: 'https://huskers.com', roster: '/sports/baseball/roster' }, // Nebraska
  '87': { base: 'https://scarletknights.com', roster: '/sports/baseball/roster' }, // Rutgers
  
  // Pac-12 (remaining teams)
  '25': { base: 'https://calbears.com', roster: '/sports/baseball/roster' }, // Cal
  '24': { base: 'https://uclabruins.com', roster: '/sports/baseball/roster' }, // UCLA
  '30': { base: 'https://usctrojans.com', roster: '/sports/baseball/roster' }, // USC
  '198': { base: 'https://goducks.com', roster: '/sports/baseball/roster' }, // Oregon
  '204': { base: 'https://osubeavers.com', roster: '/sports/baseball/roster' }, // Oregon State
  '264': { base: 'https://gohuskies.com', roster: '/sports/baseball/roster' }, // Washington
  '265': { base: 'https://wsucougars.com', roster: '/sports/baseball/roster' }, // Washington State
  '12': { base: 'https://utahutes.com', roster: '/sports/baseball/roster' }, // Utah
};

module.exports = ATHLETIC_WEBSITES;
