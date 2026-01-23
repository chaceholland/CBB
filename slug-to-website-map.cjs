/**
 * Maps team slugs to KNOWN_WEBSITES IDs
 * This bridges the gap between teams.json IDs and athletic website IDs
 */

const SLUG_TO_WEBSITE_ID = {
  // SEC
  'alabama-crimson-tide': '333',
  'arkansas-razorbacks': '8',
  'auburn-tigers': '2',
  'florida-gators': '57',
  'georgia-bulldogs': '61',
  'kentucky-wildcats': '96',
  'lsu-tigers': '99',
  'mississippi-state-bulldogs': '344',
  'missouri-tigers': '142',
  'oklahoma-sooners': '201',
  'ole-miss-rebels': '145',
  'south-carolina-gamecocks': '2579',
  'tennessee-volunteers': '2633',
  'texas-longhorns': '251',
  'texas-am-aggies': '245',
  'vanderbilt-commodores': '238',
  
  // ACC
  'boston-college-eagles': '103',
  'clemson-tigers': '228',
  'duke-blue-devils': '93',
  'florida-state-seminoles': '52',
  'georgia-tech-yellow-jackets': '59',
  'louisville-cardinals': '97',
  'miami-hurricanes': '153',
  'north-carolina-tar-heels': '152',
  'nc-state-wolfpack': '152',
  'notre-dame-fighting-irish': '513',
  'pittsburgh-panthers': '221',
  'stanford-cardinal': '64',
  'syracuse-orange': '120',
  'virginia-cavaliers': '259',
  'virginia-tech-hokies': '154',
  'wake-forest-demon-deacons': '235',
  'california-golden-bears': '52',
  'smu-mustangs': '2567',
  
  // Big 12
  'arizona-wildcats': '9',
  'arizona-state-sun-devils': '9',
  'baylor-bears': '239',
  'byu-cougars': '236',
  'cincinnati-bearcats': '38',
  'colorado-buffaloes': '66',
  'houston-cougars': '248',
  'iowa-state-cyclones': '2305',
  'kansas-jayhawks': '2305',
  'kansas-state-wildcats': '2305',
  'oklahoma-state-cowboys': '197',
  'tcu-horned-frogs': '251',
  'texas-tech-red-raiders': '251',
  'west-virginia-mountaineers': '277',
  'ucf-knights': '2116',
  
  // Big Ten
  'illinois-fighting-illini': '356',
  'indiana-hoosiers': '84',
  'iowa-hawkeyes': '84',
  'maryland-terrapins': '135',
  'michigan-wolverines': '130',
  'michigan-state-spartans': '127',
  'minnesota-golden-gophers': '135',
  'nebraska-cornhuskers': '158',
  'northwestern-wildcats': '77',
  'ohio-state-buckeyes': '194',
  'penn-state-nittany-lions': '213',
  'purdue-boilermakers': '2509',
  'rutgers-scarlet-knights': '87',
  'wisconsin-badgers': '275',
  'ucla-bruins': '24',
  'usc-trojans': '30',
  'oregon-ducks': '198',
  'washington-huskies': '264',
  
  // Pac-12
  'oregon-state-beavers': '204',
  'washington-state-cougars': '265'
};

module.exports = SLUG_TO_WEBSITE_ID;
