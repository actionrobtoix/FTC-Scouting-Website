const WATCHLIST_KEY = "action_scout_watchlist";
const LIVE_SEASON_KEY = "action_scout_live_season";
const DECODE_SEASON = 2025;
const MOKS_LEAGUES = ["STL North", "STL Mid", "STL South", "SE", "SW", "Central", "KC East", "KC West"];

const seededTeams = [
  { teamNumber: 11115, name: "Gluten Free", country: "USA", region: "California" },
  { teamNumber: 6547, name: "CCE RoboRaiders", country: "USA", region: "Texas" },
  { teamNumber: 3101, name: "Boom Bots", country: "USA", region: "Washington" },
  { teamNumber: 8393, name: "Robo Minions", country: "USA", region: "New York" },
  { teamNumber: 7244, name: "Out of the Box", country: "USA", region: "Florida" },
  { teamNumber: 16072, name: "Quantum Quacks", country: "USA", region: "Illinois" },
  { teamNumber: 14614, name: "Syntax Error", country: "USA", region: "Pennsylvania" },
  { teamNumber: 9986, name: "Droids Robotics", country: "USA", region: "North Carolina" },
  { teamNumber: 16093, name: "Nifty Ninjas", country: "USA", region: "Ohio" },
  { teamNumber: 17014, name: "Iron Giants", country: "USA", region: "Michigan" },
  { teamNumber: 19567, name: "Blue Voltage", country: "Canada", region: "Ontario" },
  { teamNumber: 18721, name: "Maple Mechanics", country: "Canada", region: "British Columbia" },
  { teamNumber: 20211, name: "Tokyo Cyclones", country: "Japan", region: "Kanto" },
  { teamNumber: 20904, name: "Osaka Orbit", country: "Japan", region: "Kansai" },
  { teamNumber: 22871, name: "Seoul Drive", country: "South Korea", region: "Seoul" },
  { teamNumber: 23220, name: "Busan Titans", country: "South Korea", region: "Busan" },
  { teamNumber: 24102, name: "Manchester Mechs", country: "United Kingdom", region: "England" },
  { teamNumber: 24589, name: "Highland Robotics", country: "United Kingdom", region: "Scotland" },
  { teamNumber: 25811, name: "Berlin Bolt", country: "Germany", region: "Berlin" },
  { teamNumber: 26107, name: "Bavarian Bots", country: "Germany", region: "Bavaria" }
];

const countryRegions = {
  USA: ["California", "Texas", "Florida", "Washington", "New York", "Illinois", "Ohio", "Michigan", "North Carolina", "Pennsylvania"],
  Canada: ["Ontario", "Quebec", "Alberta", "British Columbia"],
  Mexico: ["Nuevo Leon", "Jalisco", "Mexico City"],
  Japan: ["Kanto", "Kansai", "Tohoku"],
  "South Korea": ["Seoul", "Busan", "Gyeonggi"],
  "United Kingdom": ["England", "Scotland", "Wales"],
  Germany: ["Bavaria", "Berlin", "Hesse"],
  Australia: ["New South Wales", "Victoria", "Queensland"],
  India: ["Maharashtra", "Karnataka", "Tamil Nadu"]
};

const el = {
  navList: document.getElementById("nav-list"),
  views: [...document.querySelectorAll(".view")],
  globalSearch: document.getElementById("global-search"),
  clearFilters: document.getElementById("clear-filters"),
  statGrid: document.getElementById("stat-grid"),
  capabilityBars: document.getElementById("capability-bars"),
  topTargets: document.getElementById("top-targets"),
  seasonInput: document.getElementById("season-input"),
  rankingSort: document.getElementById("ranking-sort"),
  rankingLeague: document.getElementById("ranking-league"),
  rankingCountry: document.getElementById("ranking-country"),
  rankingTable: document.getElementById("ranking-table"),
  filterLeague: document.getElementById("filter-league"),
  filterCountry: document.getElementById("filter-country"),
  filterEpa: document.getElementById("filter-epa"),
  filterWinrate: document.getElementById("filter-winrate"),
  filterEndgame: document.getElementById("filter-endgame"),
  filterAutoSpecialist: document.getElementById("filter-auto-specialist"),
  filterLowPenalty: document.getElementById("filter-low-penalty"),
  teamCount: document.getElementById("team-count"),
  teamList: document.getElementById("team-list"),
  teamDetail: document.getElementById("team-detail"),
  watchlistList: document.getElementById("watchlist-list"),
  compareA: document.getElementById("compare-a"),
  compareB: document.getElementById("compare-b"),
  runCompare: document.getElementById("run-compare"),
  compareResult: document.getElementById("compare-result"),
  myteamName: document.getElementById("myteam-name"),
  myteamTarget: document.getElementById("myteam-target"),
  myteamAuto: document.getElementById("myteam-auto"),
  myteamTeleop: document.getElementById("myteam-teleop"),
  myteamEndgame: document.getElementById("myteam-endgame"),
  myteamConsistency: document.getElementById("myteam-consistency"),
  myteamPenalties: document.getElementById("myteam-penalties"),
  myteamReport: document.getElementById("myteam-report"),
  myteamOutput: document.getElementById("myteam-output"),
  jsonUpload: document.getElementById("json-upload"),
  loadLive: document.getElementById("load-live"),
  dataStatus: document.getElementById("data-status")
};

const state = {
  teams: [],
  watchlist: new Set(JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]")),
  selectedTeam: null,
  liveMode: false,
  season: Number(localStorage.getItem(LIVE_SEASON_KEY) || 0) || null,
  source: "none",
  loadingTeamNumbers: new Set(),
  hydratingAllStats: false,
  awardsByTeam: {}
};

const rankingMetrics = [
  { value: "opr", label: "OPR" },
  { value: "fitScore", label: "Alliance Fit" },
  { value: "epa", label: "EPA" },
  { value: "winRate", label: "Win Rate" },
  { value: "consistency", label: "Consistency" },
  { value: "autoPoints", label: "Auto Points" },
  { value: "endgamePoints", label: "Endgame Points" }
];

function seededRand(seed) {
  const x = Math.sin(seed * 999.91) * 10000;
  return x - Math.floor(x);
}

function pick(arr, seed) {
  return arr[Math.floor(seededRand(seed) * arr.length) % arr.length];
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function pct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
  return `${Math.round(v * 100)}%`;
}

function num(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
  return Number(v).toFixed(d);
}

function valueOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDefaultSeason() {
  return DECODE_SEASON;
}

function pickNumberByKeys(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      const parsed = Number(obj[key]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeLeagueLabel(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  if (/stl[\s_-]*(north|n\b)|st\.?\s*louis[\s_-]*north/.test(v)) return "STL North";
  if (/stl[\s_-]*(mid|mi\b)|st\.?\s*louis[\s_-]*(mid|mi\b)/.test(v)) return "STL Mid";
  if (/stl[\s_-]*(south|s\b)|st\.?\s*louis[\s_-]*south/.test(v)) return "STL South";
  if (/kc[\s_-]*east|kce\b|kansas city[\s_-]*east/.test(v)) return "KC East";
  if (/kc[\s_-]*west|kcw\b|kansas city[\s_-]*west/.test(v)) return "KC West";
  if (/(^|\W)se(\W|$)|south[\s_-]*east/.test(v)) return "SE";
  if (/(^|\W)sw(\W|$)|south[\s_-]*west/.test(v)) return "SW";
  if (/central|cen\b/.test(v)) return "Central";
  return null;
}

function inferLeague(raw) {
  const direct = [
    raw.league,
    raw.league_name,
    raw.leagueName,
    raw.league_code,
    raw.district
  ].filter(Boolean);
  for (const value of direct) {
    const normalized = normalizeLeagueLabel(value);
    if (normalized) return normalized;
  }

  const state = String(raw.state || "").toUpperCase();
  const city = String(raw.city || "").toLowerCase();

  if (state === "KS") {
    if (/overland park|olathe|lenexa|shawnee|prairie village|roeland park|mission|leawood|stilwell|gardner|spring hill|kansas city/.test(city)) return "KC West";
    return "Central";
  }

  if (/kansas city|independence|lees summit|raytown|belton|liberty|blue springs|kearney|grain valley|harrisonville/.test(city)) return "KC East";
  if (/florissant|hazelwood|maryland heights|bridgeton|creve coeur/.test(city)) return "STL North";
  if (/st\.?\s*louis|saint louis|st louis|ballwin|chesterfield|wildwood|kirkwood|webster groves|town and country|grover/.test(city)) return "STL Mid";
  if (/arnold|imperial|de soto|festus|hillsboro|o'?fallon|st charles|saint charles|wentzville|warrenton/.test(city)) return "STL South";
  if (/cape girardeau|sikeston|poplar bluff|chaffee|jackson|kennett|hayti|perryville|scott city/.test(city)) return "SE";
  if (/springfield|joplin|monett|neosho|ozark|branson|hollister|wheaton|pierce city|bakersfield/.test(city)) return "SW";
  return "Central";
}

function uniqueTeamsById(list) {
  const map = new Map();
  list.forEach((team) => {
    if (!team || team.id === undefined || team.id === null) return;
    const key = String(team.id);
    if (!map.has(key)) {
      map.set(key, team);
      return;
    }
    const existing = map.get(key);
    if (!existing.statsLoaded && team.statsLoaded) map.set(key, team);
  });
  return [...map.values()];
}

function buildTeam(base, idx = 0) {
  const seed = base.teamNumber + idx * 17;
  const matches = 24 + Math.floor(seededRand(seed + 1) * 30);
  const wins = Math.floor(matches * (0.35 + seededRand(seed + 2) * 0.5));
  const ties = Math.floor(seededRand(seed + 3) * 3);
  const losses = Math.max(matches - wins - ties, 0);
  const winRate = wins / Math.max(matches, 1);

  const autoPoints = 18 + seededRand(seed + 4) * 35;
  const teleopPoints = 35 + seededRand(seed + 5) * 65;
  const endgamePoints = 10 + seededRand(seed + 6) * 40;
  const doubleParkRate = seededRand(seed + 7) * 0.78;
  const singleParkRate = clamp(0.3 + seededRand(seed + 8) * 0.7 - doubleParkRate * 0.4, 0.1, 0.98);
  const climbRate = seededRand(seed + 9) * 0.9;
  const penaltiesPerMatch = 0.2 + seededRand(seed + 10) * 1.9;
  const cycleTime = 6 + seededRand(seed + 11) * 11;
  const consistency = 58 + seededRand(seed + 12) * 40;
  const shootingZone = pick(["Backstage", "Center Line", "Wing", "Unknown"], seed + 15);

  const epa = autoPoints * 0.42 + teleopPoints * 0.38 + endgamePoints * 0.3 - penaltiesPerMatch * 2;
  const opr = epa * (0.94 + seededRand(seed + 13) * 0.2);
  const rankingPoints = wins * 2 + ties + Math.round(seededRand(seed + 14) * 8);
  const autoSpecialist = autoPoints >= 34;
  const lowPenalty = penaltiesPerMatch <= 0.85;
  const fitScore = clamp(
    epa * 0.58 + consistency * 0.38 + winRate * 35 + climbRate * 14 - penaltiesPerMatch * 5,
    0,
    100
  );

  const tags = [];
  if (autoSpecialist) tags.push("Auto Specialist");
  if (consistency >= 82) tags.push("Stable Driver");
  if (lowPenalty) tags.push("Low Penalty");
  if (climbRate >= 0.55) tags.push("Reliable Climb");

  return {
    id: String(base.teamNumber),
    teamNumber: base.teamNumber,
    name: base.name,
    country: base.country,
    region: base.region,
    matches,
    wins,
    losses,
    ties,
    winRate,
    epa,
    opr,
    rankingPoints,
    autoPoints,
    teleopPoints,
    endgamePoints,
    doubleParkRate,
    singleParkRate,
    climbRate,
    penaltiesPerMatch,
    cycleTime,
    consistency,
    shootingZone,
    maxAuto: autoPoints * (1.35 + seededRand(seed + 16) * 0.35),
    maxTeleop: teleopPoints * (1.3 + seededRand(seed + 17) * 0.4),
    maxTotal: (autoPoints + teleopPoints + endgamePoints) * (1.2 + seededRand(seed + 18) * 0.35),
    autoSpecialist,
    lowPenalty,
    fitScore,
    tags
  };
}

function generateName(i) {
  const first = ["Vertex", "Titan", "Blue", "Nova", "Quantum", "Cyber", "Fusion", "Velocity", "Apex", "Vector"];
  const second = ["Circuit", "Drive", "Dynamics", "Forge", "Mechanics", "Raiders", "Bots", "Pulse", "Collective", "Alliance"];
  return `${first[i % first.length]} ${second[(i * 3) % second.length]}`;
}

function buildDemoDataset() {
  const dataset = seededTeams.map((item, idx) => buildTeam(item, idx));
  let teamNumber = 30000;
  const countries = Object.keys(countryRegions);

  for (let i = 0; i < 180; i += 1) {
    const country = countries[i % countries.length];
    const region = pick(countryRegions[country], i + 44);
    const base = {
      teamNumber: teamNumber + i,
      name: generateName(i),
      country,
      region
    };
    dataset.push(buildTeam(base, i + 99));
  }
  return dataset;
}

function normalizeImportedTeam(raw, idx) {
  const country = raw.country || raw.nation || "USA";
  const knownRegions = countryRegions[country] || ["Unknown Region"];
  const region = raw.region || raw.state || raw.province || knownRegions[0];
  const base = {
    teamNumber: Number(raw.teamNumber || raw.team || raw.number || 40000 + idx),
    name: raw.name || raw.teamName || `Imported Team ${idx + 1}`,
    country,
    region
  };

  if (raw.epa || raw.winRate || raw.autoPoints) {
    const built = buildTeam(base, idx + 500);
    built.matches = Number(raw.matches || built.matches);
    built.wins = Number(raw.wins || built.wins);
    built.losses = Number(raw.losses || built.losses);
    built.ties = Number(raw.ties || built.ties);
    built.winRate = raw.winRate !== undefined ? Number(raw.winRate) : built.wins / Math.max(built.matches, 1);
    built.epa = Number(raw.epa || built.epa);
    built.opr = Number(raw.opr || built.opr);
    built.autoPoints = Number(raw.autoPoints || built.autoPoints);
    built.teleopPoints = Number(raw.teleopPoints || built.teleopPoints);
    built.endgamePoints = Number(raw.endgamePoints || built.endgamePoints);
    built.doubleParkRate = Number(raw.doubleParkRate ?? built.doubleParkRate);
    built.singleParkRate = Number(raw.singleParkRate ?? built.singleParkRate);
    built.climbRate = Number(raw.climbRate ?? built.climbRate);
    built.penaltiesPerMatch = Number(raw.penaltiesPerMatch ?? built.penaltiesPerMatch);
    built.cycleTime = Number(raw.cycleTime ?? built.cycleTime);
    built.consistency = Number(raw.consistency ?? built.consistency);
    built.shootingZone = raw.shootingZone || raw.shootFrom || built.shootingZone || "Unknown";
    built.maxAuto = Number(raw.maxAuto ?? raw.max_auto ?? built.maxAuto);
    built.maxTeleop = Number(raw.maxTeleop ?? raw.max_teleop ?? built.maxTeleop);
    built.maxTotal = Number(raw.maxTotal ?? raw.max_total ?? built.maxTotal);
    built.fitScore = clamp(
      built.epa * 0.58 + built.consistency * 0.38 + built.winRate * 35 + built.climbRate * 14 - built.penaltiesPerMatch * 5,
      0,
      100
    );
    built.autoSpecialist = built.autoPoints >= 34;
    built.lowPenalty = built.penaltiesPerMatch <= 0.85;
    built.tags = [
      built.autoSpecialist ? "Auto Specialist" : "",
      built.consistency >= 82 ? "Stable Driver" : "",
      built.lowPenalty ? "Low Penalty" : "",
      built.climbRate >= 0.55 ? "Reliable Climb" : ""
    ].filter(Boolean);
    return built;
  }

  return buildTeam(base, idx + 500);
}

function mapFtcScoutTeam(raw, idx) {
  const teamNum = Number(raw.team_number || raw.teamNumber || raw.number || raw.team || 50000 + idx);
  const teamName = raw.name || raw.team_name || raw.teamName || `FTC Team ${teamNum}`;
  const country = raw.country || raw.country_code || "Unknown";
  const region = raw.region || raw.state_prov || raw.state || "Unknown Region";
  const city = raw.city || raw.town || "";
  const league = inferLeague(raw);
  const record = raw.record || {};
  const merged = { ...raw, ...record };
  const wins = pickNumberByKeys(merged, ["wins", "record_wins"]);
  const losses = pickNumberByKeys(merged, ["losses", "record_losses"]);
  const ties = pickNumberByKeys(merged, ["ties", "record_ties"]);
  const matches = valueOrNull((wins || 0) + (losses || 0) + (ties || 0)) || pickNumberByKeys(merged, ["matches", "matches_played"]);
  const winRateRaw = pickNumberByKeys(merged, ["win_rate", "win_pct", "record_win_pct"]);
  const winRate = winRateRaw !== null ? (winRateRaw > 1 ? winRateRaw / 100 : winRateRaw) : null;
  const autoPoints = pickNumberByKeys(merged, ["auto_avg", "avg_auto", "auto", "auto_points_avg", "auto_point_avg"]);
  const teleopPoints = pickNumberByKeys(merged, ["teleop_avg", "avg_teleop", "teleop", "teleop_points_avg", "driver_avg"]);
  const epa = pickNumberByKeys(merged, ["total_avg", "avg_total", "epa", "total", "np_avg"]);
  const opr = pickNumberByKeys(merged, ["np_opr", "opr", "total_opr", "total_np"]);
  const totalValue = Number.isFinite(opr) ? opr : epa;
  const endgamePointsRaw = pickNumberByKeys(merged, [
    "endgame_avg",
    "end_game_avg",
    "avg_endgame",
    "endgame",
    "endgame_points_avg",
    "end_game_points_avg"
  ]);
  const endgamePoints =
    endgamePointsRaw !== null
      ? endgamePointsRaw
      : Number.isFinite(totalValue) && Number.isFinite(autoPoints) && Number.isFinite(teleopPoints)
        ? Math.max(0, totalValue - autoPoints - teleopPoints)
        : null;
  const consistencyStd = pickNumberByKeys(merged, ["std_total", "stddev_total"]);
  const consistency = consistencyStd !== null ? clamp(95 - consistencyStd * 2.3, 35, 99) : null;
  const penaltiesPerMatch = pickNumberByKeys(merged, ["penalties_per_match", "avg_penalties"]);
  const maxAuto = pickNumberByKeys(merged, ["auto_max", "max_auto"]);
  const maxTeleop = pickNumberByKeys(merged, ["teleop_max", "max_teleop"]);
  const maxTotal = pickNumberByKeys(merged, ["total_max", "max_total"]);
  const shootingZone = merged.shooting_zone || merged.shootingZone || "Unknown";
  const rankingPoints = pickNumberByKeys(merged, ["ranking_points", "rp", "rp_total"]);
  const doubleParkRate = pickNumberByKeys(merged, ["double_park_rate", "doubleParkRate"]);
  const singleParkRate = pickNumberByKeys(merged, ["single_park_rate", "singleParkRate"]);
  const climbRate = pickNumberByKeys(merged, ["climb_rate", "hang_rate", "ascent_rate"]);
  const fitInputsPresent =
    epa !== null &&
    consistency !== null &&
    winRate !== null &&
    penaltiesPerMatch !== null;
  const fitScore = fitInputsPresent
    ? clamp(epa * 0.62 + consistency * 0.32 + winRate * 34 - penaltiesPerMatch * 5, 0, 100)
    : null;
  const autoSpecialist = autoPoints !== null && autoPoints >= 32;
  const lowPenalty = penaltiesPerMatch !== null && penaltiesPerMatch <= 0.85;
  const tags = [
    autoSpecialist ? "Auto Specialist" : "",
    consistency !== null && consistency >= 82 ? "Stable Driver" : "",
    lowPenalty ? "Low Penalty" : "",
    Number.isFinite(endgamePoints) && endgamePoints >= 12 ? "Strong Endgame" : ""
  ].filter(Boolean);

  return {
    id: String(teamNum),
    teamNumber: teamNum,
    name: teamName,
    country,
    region,
    city,
    league,
    matches,
    wins,
    losses,
    ties,
    winRate,
    epa,
    opr,
    rankingPoints,
    autoPoints,
    teleopPoints,
    endgamePoints,
    doubleParkRate,
    singleParkRate,
    climbRate,
    penaltiesPerMatch,
    cycleTime: pickNumberByKeys(raw, ["cycle_time", "avg_cycle_time"]),
    consistency,
    shootingZone,
    maxAuto,
    maxTeleop,
    maxTotal,
    autoSpecialist,
    lowPenalty,
    fitScore,
    tags,
    statsLoaded: autoPoints !== null || teleopPoints !== null || endgamePoints !== null || epa !== null || opr !== null
  };
}

function mergeDecodeRecord(team, record) {
  if (!record) return team;
  const wins = valueOrNull(record.wins) ?? team.wins;
  const losses = valueOrNull(record.losses) ?? team.losses;
  const ties = valueOrNull(record.ties) ?? team.ties;
  const matches = valueOrNull((wins || 0) + (losses || 0) + (ties || 0)) || team.matches;
  const winRate = matches ? wins / matches : team.winRate;
  const autoPoints = valueOrNull(record.auto_opr) ?? team.autoPoints;
  const teleopPoints = valueOrNull(record.teleop_opr) ?? team.teleopPoints;
  const epa = valueOrNull(record.np_avg) ?? team.epa;
  const opr = valueOrNull(record.np_opr) ?? team.opr;
  const totalNp = valueOrNull(record.np_opr) ?? valueOrNull(record.np_avg) ?? valueOrNull(team.opr) ?? valueOrNull(team.epa) ?? null;
  const nextAuto = autoPoints ?? team.autoPoints;
  const nextTele = teleopPoints ?? team.teleopPoints;
  const computedEndgame =
    Number.isFinite(totalNp) && Number.isFinite(nextAuto) && Number.isFinite(nextTele)
      ? Math.max(0, totalNp - nextAuto - nextTele)
      : null;
  const endgamePoints = valueOrNull(record.endgame_opr) ?? computedEndgame ?? valueOrNull(team.endgamePoints) ?? 0;

  const next = {
    ...team,
    name: record.name || team.name,
    wins,
    losses,
    ties,
    matches,
    winRate,
    autoPoints: nextAuto,
    teleopPoints: nextTele,
    endgamePoints,
    epa: valueOrNull(record.np_avg) ?? epa,
    opr,
    statsLoaded: true
  };

  next.fitScore = Number.isFinite(next.opr) && Number.isFinite(next.winRate)
    ? clamp(next.opr * 0.55 + next.winRate * 35 + (next.consistency ?? 60) * 0.18, 0, 100)
    : next.fitScore;
  return next;
}

function mergeQuickStats(team, stats) {
  const source = stats.quick_stats || stats.quickStats || stats;
  const record = source.record || {};
  const mergedSource = { ...source, ...record };

  const autoPoints = pickNumberByKeys(mergedSource, ["auto_avg", "avg_auto", "auto", "auto_points_avg", "auto_point_avg"]);
  const teleopPoints = pickNumberByKeys(mergedSource, ["teleop_avg", "avg_teleop", "teleop", "teleop_points_avg", "driver_avg"]);
  const endgamePoints = pickNumberByKeys(mergedSource, [
    "endgame_avg",
    "end_game_avg",
    "avg_endgame",
    "endgame",
    "endgame_points_avg",
    "end_game_points_avg"
  ]);
  const epa = pickNumberByKeys(mergedSource, ["total_avg", "avg_total", "epa", "total", "np_avg"]);
  const opr = pickNumberByKeys(mergedSource, ["np_opr", "opr", "total_opr", "total_np"]);
  const maxAuto = pickNumberByKeys(mergedSource, ["auto_max", "max_auto"]);
  const maxTeleop = pickNumberByKeys(mergedSource, ["teleop_max", "max_teleop"]);
  const maxTotal = pickNumberByKeys(mergedSource, ["total_max", "max_total"]);
  const wins = pickNumberByKeys(mergedSource, ["wins", "record_wins"]) ?? team.wins;
  const losses = pickNumberByKeys(mergedSource, ["losses", "record_losses"]) ?? team.losses;
  const ties = pickNumberByKeys(mergedSource, ["ties", "record_ties"]) ?? team.ties;
  const matches = valueOrNull((wins || 0) + (losses || 0) + (ties || 0)) || team.matches;
  const winRateRaw = pickNumberByKeys(mergedSource, ["win_rate", "win_pct", "record_win_pct"]);
  const winRate = winRateRaw !== null ? (winRateRaw > 1 ? winRateRaw / 100 : winRateRaw) : team.winRate;
  const penaltiesPerMatch = pickNumberByKeys(mergedSource, ["penalties_per_match", "avg_penalties"]) ?? team.penaltiesPerMatch;
  const consistencyStd = pickNumberByKeys(mergedSource, ["std_total", "stddev_total"]);
  const consistency = consistencyStd !== null ? clamp(95 - consistencyStd * 2.3, 35, 99) : team.consistency;
  const shootingZone = mergedSource.shooting_zone || mergedSource.shootingZone || team.shootingZone || "Unknown";
  const doubleParkRate = pickNumberByKeys(mergedSource, ["double_park_rate", "doubleParkRate"]) ?? team.doubleParkRate;
  const singleParkRate = pickNumberByKeys(mergedSource, ["single_park_rate", "singleParkRate"]) ?? team.singleParkRate;
  const climbRate = pickNumberByKeys(mergedSource, ["climb_rate", "hang_rate", "ascent_rate"]) ?? team.climbRate;
  const nextAuto = autoPoints ?? team.autoPoints;
  const nextTele = teleopPoints ?? team.teleopPoints;
  const totalValue = Number.isFinite(opr) ? opr : epa;
  const computedEndgame =
    Number.isFinite(totalValue) && Number.isFinite(nextAuto) && Number.isFinite(nextTele)
      ? Math.max(0, totalValue - nextAuto - nextTele)
      : null;
  const normalizedEndgame = endgamePoints ?? computedEndgame ?? team.endgamePoints ?? 0;

  const next = {
    ...team,
    autoPoints: nextAuto,
    teleopPoints: nextTele,
    endgamePoints: normalizedEndgame,
    epa: epa ?? team.epa,
    opr: opr ?? team.opr,
    maxAuto: maxAuto ?? team.maxAuto,
    maxTeleop: maxTeleop ?? team.maxTeleop,
    maxTotal: maxTotal ?? team.maxTotal,
    wins,
    losses,
    ties,
    matches,
    winRate,
    penaltiesPerMatch,
    consistency,
    shootingZone,
    doubleParkRate,
    singleParkRate,
    climbRate,
    statsLoaded: true
  };

  next.autoSpecialist = next.autoPoints !== null && next.autoPoints >= 32;
  next.lowPenalty = next.penaltiesPerMatch !== null && next.penaltiesPerMatch <= 0.85;
  const fitInputsPresent =
    next.epa !== null &&
    next.consistency !== null &&
    next.winRate !== null &&
    next.penaltiesPerMatch !== null;
  next.fitScore = fitInputsPresent
    ? clamp(
        next.epa * 0.62 + next.consistency * 0.32 + next.winRate * 34 - next.penaltiesPerMatch * 5,
        0,
        100
      )
    : null;
  next.tags = [
    next.autoSpecialist ? "Auto Specialist" : "",
    next.consistency !== null && next.consistency >= 82 ? "Stable Driver" : "",
    next.lowPenalty ? "Low Penalty" : "",
    Number.isFinite(next.endgamePoints) && next.endgamePoints >= 12 ? "Strong Endgame" : ""
  ].filter(Boolean);

  return next;
}

function sortByMetric(list, metric) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    const av = Number(a[metric]);
    const bv = Number(b[metric]);
    const aValid = Number.isFinite(av);
    const bValid = Number.isFinite(bv);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return bv - av;
  });
  return sorted;
}

function setSelectOptions(select, values) {
  const previous = select.value;
  const opts = ["all", ...values];
  select.innerHTML = opts
    .map((v) => `<option value="${v}">${v === "all" ? "All" : v}</option>`)
    .join("");
  if (opts.includes(previous)) select.value = previous;
}

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...state.watchlist]));
}

function switchView(viewId) {
  el.views.forEach((view) => {
    view.classList.toggle("active", view.id === `view-${viewId}`);
  });
  [...el.navList.querySelectorAll(".nav-btn")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
}

function filteredTeams() {
  const query = el.globalSearch.value.trim().toLowerCase();
  const selectedLeague = el.filterLeague.value;
  const selectedCountry = el.filterCountry.value;
  const minEPA = Number(el.filterEpa.value || 0);
  const minWinRate = Number(el.filterWinrate.value || 0) / 100;
  const endgameMode = el.filterEndgame.value;
  const autoOnly = el.filterAutoSpecialist.checked;
  const lowPenaltyOnly = el.filterLowPenalty.checked;

  return state.teams.filter((team) => {
    if (query && !`${team.teamNumber} ${team.name}`.toLowerCase().includes(query)) return false;
    if (selectedLeague !== "all" && team.league !== selectedLeague) return false;
    if (selectedCountry !== "all" && team.country !== selectedCountry) return false;
    if (minEPA > 0 && (!Number.isFinite(team.epa) || team.epa < minEPA)) return false;
    if (minWinRate > 0 && (!Number.isFinite(team.winRate) || team.winRate < minWinRate)) return false;
    if (autoOnly && !team.autoSpecialist) return false;
    if (lowPenaltyOnly && !team.lowPenalty) return false;

    if (endgameMode === "singlePark" && (!Number.isFinite(team.singleParkRate) || team.singleParkRate < 0.62)) return false;

    return true;
  });
}

function renderOverview() {
  const teams = state.teams;
  if (!teams.length) {
    el.statGrid.innerHTML = "";
    el.capabilityBars.innerHTML = '<div class="empty">No teams loaded. Use FTCScout live load.</div>';
    el.topTargets.innerHTML = '<div class="empty">No teams loaded.</div>';
    return;
  }
  const epaValues = teams.map((t) => Number(t.epa)).filter((v) => Number.isFinite(v));
  const avgEPA = epaValues.length ? epaValues.reduce((sum, v) => sum + v, 0) / epaValues.length : null;
  const cities = new Set(teams.map((t) => String(t.city || t.region || "").trim()).filter(Boolean)).size;

  el.statGrid.innerHTML = `
    <article class="stat-card"><p class="label">Total Teams Indexed</p><p class="value">${teams.length}</p></article>
    <article class="stat-card"><p class="label">Cities</p><p class="value">${cities}</p></article>
    <article class="stat-card"><p class="label">Average EPA</p><p class="value">${num(avgEPA, 1)}</p></article>
    <article class="stat-card"><p class="label">Leagues Represented</p><p class="value">8</p></article>
  `;

  const withAuto = teams.filter((t) => Number.isFinite(t.autoPoints)).length;
  const withTele = teams.filter((t) => Number.isFinite(t.teleopPoints)).length;
  const withEnd = teams.filter((t) => Number.isFinite(t.endgamePoints)).length;
  const withTotal = teams.filter((t) => Number.isFinite(t.opr) || Number.isFinite(t.epa)).length;
  const withRecord = teams.filter((t) => Number.isFinite(t.wins) || Number.isFinite(t.losses) || Number.isFinite(t.ties)).length;
  const capabilityItems = [
    { label: "Auto Data Coverage", value: teams.length ? withAuto / teams.length : 0 },
    { label: "Teleop Data Coverage", value: teams.length ? withTele / teams.length : 0 },
    { label: "Endgame Data Coverage", value: teams.length ? withEnd / teams.length : 0 },
    { label: "Total NP Coverage", value: teams.length ? withTotal / teams.length : 0 },
    { label: "Record Data Coverage", value: teams.length ? withRecord / teams.length : 0 }
  ];

  el.capabilityBars.innerHTML = capabilityItems
    .map(
      (item) => `
      <div class="bar-row">
        <span>${item.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${item.value * 100}%"></div></div>
        <strong>${pct(item.value)}</strong>
      </div>
    `
    )
    .join("");

  el.topTargets.innerHTML = sortByMetric(teams, "fitScore")
    .slice(0, 8)
    .map(
      (team, idx) => `
      <article class="target-row" data-team-id="${team.id}">
        <header>
          <strong>#${idx + 1} • ${team.teamNumber} ${team.name}</strong>
          <span>${num(team.fitScore, 1)} fit</span>
        </header>
        <div class="team-meta"><span>${team.country}</span><span>${team.region}</span><span>EPA ${num(team.epa, 1)}</span><span>Win ${pct(team.winRate)}</span></div>
      </article>
    `
    )
    .join("");
}

function renderRankings() {
  if (!state.teams.length) {
    el.rankingTable.innerHTML = '<div class="empty">No teams loaded. Use FTCScout live load.</div>';
    return;
  }
  const metric = el.rankingSort.value;
  const league = el.rankingLeague.value;
  const country = el.rankingCountry.value;

  const teams = sortByMetric(
    state.teams.filter(
      (team) =>
        (league === "all" || team.league === league) &&
        (country === "all" || team.country === country)
    ),
    metric
  );

  el.rankingTable.innerHTML = teams
    .slice(0, 150)
    .map(
      (team, idx) => `
      <article class="rank-row" data-team-id="${team.id}">
        <span>${idx + 1}</span>
        <strong>${team.teamNumber} ${team.name}</strong>
        <span>${team.league || team.country}</span>
        <span>EPA ${num(team.epa, 1)}</span>
        <span>Win ${pct(team.winRate)}</span>
        <span>${num(team[metric], 1)}</span>
      </article>
    `
    )
    .join("");

  if (state.liveMode) {
    const ids = teams.slice(0, 60).map((team) => team.id);
    prefetchTeamStats(ids, 60);
  }
}

function renderTeamList() {
  const teams = sortByMetric(filteredTeams(), "fitScore");
  el.teamCount.textContent = `${teams.length} teams found`;
  if (state.liveMode) {
    const ids = teams.slice(0, 200).map((team) => team.id);
    prefetchTeamStats(ids, 200);
  }

  if (!teams.length) {
    el.teamList.innerHTML = '<div class="empty">No teams match this scout filter. Broaden your query.</div>';
    return;
  }

  el.teamList.innerHTML = teams
    .slice(0, 250)
    .map(
      (team) => `
      <article class="team-row" data-team-id="${team.id}">
        <header>
          <strong>${team.teamNumber} ${team.name}</strong>
          <div class="row-actions">
            <button class="view-team">View</button>
            <button class="primary watch-toggle">${state.watchlist.has(team.id) ? "Saved" : "Watch"}</button>
          </div>
        </header>
        <div class="team-meta"><span>${team.country}</span><span>${team.region}</span><span>${team.league || "Unknown League"}</span><span>EPA ${num(team.epa, 1)}</span><span>Win ${pct(team.winRate)}</span><span>Fit ${num(team.fitScore, 1)}</span></div>
        <div class="badges">${team.tags.slice(0, 4).map((tag) => `<span class="badge">${tag}</span>`).join("")}</div>
      </article>
    `
    )
    .join("");
}

function metricBars(team) {
  return radarChart(team, "single");
}

function profileMetrics(team) {
  return [
    { label: "Total NP", value: team.opr ?? team.epa, max: 180 },
    { label: "Auto", value: team.autoPoints, max: 80 },
    { label: "Teleop", value: team.teleopPoints, max: 120 },
    { label: "Endgame", value: team.endgamePoints, max: 80 }
  ];
}

function radarPoints(values, radius, cx, cy) {
  const n = values.length;
  return values
    .map((value, i) => {
      const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / n;
      const x = cx + Math.cos(angle) * radius * value;
      const y = cy + Math.sin(angle) * radius * value;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function radarGrid(level, count, radius, cx, cy) {
  const points = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / count;
    const x = cx + Math.cos(angle) * radius * level;
    const y = cy + Math.sin(angle) * radius * level;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<polygon points="${points}" class="radar-grid" />`;
}

function radarChart(team, mode = "single", secondTeam = null) {
  const metricsA = profileMetrics(team);
  const normA = metricsA.map((m) => clamp((m.value ?? 0) / m.max, 0, 1));
  const cx = 120;
  const cy = 110;
  const radius = 78;
  const baseAxes = metricsA
    .map((_, i) => {
      const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / metricsA.length;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-axis" />`;
    })
    .join("");
  const labels = metricsA
    .map((m, i) => {
      const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / metricsA.length;
      const x = cx + Math.cos(angle) * (radius + 20);
      const y = cy + Math.sin(angle) * (radius + 20);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="radar-label">${m.label}</text>`;
    })
    .join("");
  const polyA = radarPoints(normA, radius, cx, cy);

  let polyB = "";
  if (mode === "compare" && secondTeam) {
    const metricsB = profileMetrics(secondTeam);
    const normB = metricsB.map((m) => clamp((m.value ?? 0) / m.max, 0, 1));
    polyB = `<polygon points="${radarPoints(normB, radius, cx, cy)}" class="radar-shape-b" />`;
  }

  return `
    <div class="radar-wrap">
      <svg viewBox="0 0 240 220" class="radar-svg" role="img" aria-label="Team radar chart">
        ${radarGrid(1, metricsA.length, radius, cx, cy)}
        ${radarGrid(0.75, metricsA.length, radius, cx, cy)}
        ${radarGrid(0.5, metricsA.length, radius, cx, cy)}
        ${radarGrid(0.25, metricsA.length, radius, cx, cy)}
        ${baseAxes}
        <polygon points="${polyA}" class="radar-shape-a" />
        ${polyB}
        ${labels}
      </svg>
    </div>
  `;
}

function renderTeamDetail(teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return;
  state.selectedTeam = team.id;
  const cachedAwards = state.awardsByTeam[team.id];
  if (!team.statsLoaded) {
    ensureTeamStats(team.id).then((loaded) => {
      if (!loaded) return;
      if (state.selectedTeam !== team.id) return;
      renderTeamList();
      renderWatchlist();
      renderTeamDetail(team.id);
    });
  }
  if (!cachedAwards) {
    ensureTeamAwards(team.id).then(() => {
      if (state.selectedTeam === team.id) renderTeamDetail(team.id);
    });
  }

  const awardsHtml =
    cachedAwards === undefined
      ? '<div class="empty">Loading awards...</div>'
      : cachedAwards[0]?._error
        ? `<div class="empty">Awards unavailable: ${cachedAwards[0]._error}</div>`
      : cachedAwards.length
        ? cachedAwards
            .slice(0, 12)
            .map(
              (award) => `
            <article class="target-row">
              <header>
                <strong>${award.name || "Award"}</strong>
                <span>${award.eventCode || "Event"}</span>
              </header>
              <div class="team-meta"><span>${award.eventName || "Official FTC Event"}</span><span>${award.person ? `Recipient: ${award.person}` : `Team ${team.teamNumber}`}</span></div>
            </article>
          `
            )
            .join("")
        : '<div class="empty">No published awards found for this season/team.</div>';

  el.teamDetail.innerHTML = `
    <div class="panel-head wide">
      <h3>${team.teamNumber} ${team.name}</h3>
      <div class="row-actions">
        <button class="primary" id="detail-watch">${state.watchlist.has(team.id) ? "Remove from Watchlist" : "Add to Watchlist"}</button>
      </div>
    </div>
    <div class="team-meta"><span>${team.country}</span><span>${team.region}</span><span>${team.league || "Unknown League"}</span><span>${num(team.matches, 0)} matches</span><span>RP ${num(team.rankingPoints, 1)}</span>${team.statsLoaded ? "<span>Live stats loaded</span>" : "<span>Loading live stats...</span>"}</div>
    <div class="detail-grid">
      <article class="metric"><p>Total NP</p><h4>${num(team.opr ?? team.epa, 1)}</h4></article>
      <article class="metric"><p>Auto</p><h4>${num(team.autoPoints, 1)}</h4></article>
      <article class="metric"><p>Teleop</p><h4>${num(team.teleopPoints, 1)}</h4></article>
      <article class="metric"><p>Endgame</p><h4>${num(team.endgamePoints, 1)}</h4></article>
      <article class="metric"><p>Win-Loss-Tie</p><h4>${num(team.wins, 0)}-${num(team.losses, 0)}-${num(team.ties, 0)}</h4></article>
      <article class="metric"><p>Win Rate</p><h4>${pct(team.winRate)}</h4></article>
      <article class="metric"><p>Alliance Fit Score</p><h4>${num(team.fitScore, 1)}</h4></article>
      <article class="metric"><p>Total NP Avg</p><h4>${num(team.epa, 1)}</h4></article>
    </div>
    ${metricBars(team)}
    <div class="panel-head wide"><h3>Awards</h3></div>
    <div class="list">${awardsHtml}</div>
  `;

  const detailWatch = document.getElementById("detail-watch");
  if (detailWatch) {
    detailWatch.addEventListener("click", () => {
      toggleWatchlist(team.id);
      renderTeamDetail(team.id);
    });
  }
}

function renderCompareOptions() {
  const prevA = el.compareA.value;
  const prevB = el.compareB.value;
  const items = state.teams
    .filter((team) => state.watchlist.has(team.id))
    .sort((a, b) => a.teamNumber - b.teamNumber);
  const options = ['<option value="">Select Team</option>']
    .concat(items.map((team) => `<option value="${team.id}">${team.teamNumber} ${team.name}</option>`))
    .join("");
  el.compareA.innerHTML = options;
  el.compareB.innerHTML = options;
  if ([...state.watchlist].includes(prevA)) el.compareA.value = prevA;
  if ([...state.watchlist].includes(prevB)) el.compareB.value = prevB;

  const prevTarget = el.myteamTarget.value;
  el.myteamTarget.innerHTML = options;
  if ([...state.watchlist].includes(prevTarget)) el.myteamTarget.value = prevTarget;
}

function renderComparison() {
  const aId = el.compareA.value;
  const bId = el.compareB.value;
  if (!aId || !bId || aId === bId) {
    el.compareResult.innerHTML = '<div class="empty">Select two different watchlist teams to compare.</div>';
    return;
  }

  const teamA = state.teams.find((team) => team.id === aId);
  const teamB = state.teams.find((team) => team.id === bId);
  if (!teamA || !teamB) {
    el.compareResult.innerHTML = '<div class="empty">Comparison teams are not available.</div>';
    return;
  }
  if (!teamA.statsLoaded || !teamB.statsLoaded) {
    el.compareResult.innerHTML = '<div class="empty">Loading live stats for comparison...</div>';
    Promise.all([ensureTeamStats(teamA.id), ensureTeamStats(teamB.id)]).then((results) => {
      renderTeamList();
      renderWatchlist();
      renderComparison();
    });
    return;
  }

  el.compareResult.innerHTML = `
    <div class="compare-panel">
      <div class="compare-grid">
        <article>
          <strong>${teamA.teamNumber} ${teamA.name}</strong>
          <div class="team-meta"><span>Total NP ${num(teamA.opr ?? teamA.epa, 1)}</span><span>Auto ${num(teamA.autoPoints, 1)}</span><span>Teleop ${num(teamA.teleopPoints, 1)}</span><span>Endgame ${num(teamA.endgamePoints, 1)}</span></div>
          ${radarChart(teamA, "single")}
        </article>
        <article>
          <strong>${teamB.teamNumber} ${teamB.name}</strong>
          <div class="team-meta"><span>Total NP ${num(teamB.opr ?? teamB.epa, 1)}</span><span>Auto ${num(teamB.autoPoints, 1)}</span><span>Teleop ${num(teamB.teleopPoints, 1)}</span><span>Endgame ${num(teamB.endgamePoints, 1)}</span></div>
          ${radarChart(teamB, "single")}
        </article>
      </div>
      <div class="compare-overlay">
        <h4>Overlay Comparison</h4>
        ${radarChart(teamA, "compare", teamB)}
      </div>
    </div>
  `;
}

function renderWatchlist() {
  if (!state.teams.length) {
    renderCompareOptions();
    renderComparison();
    el.watchlistList.innerHTML = '<div class="empty">No teams loaded. Use FTCScout live load.</div>';
    return;
  }
  const items = sortByMetric(state.teams.filter((team) => state.watchlist.has(team.id)), "fitScore");
  const myTeam = getMyTeamProfile();
  renderCompareOptions();
  renderComparison();
  if (!items.length) {
    el.watchlistList.innerHTML = '<div class="empty">No teams saved yet. Use the Watch button from Team Search.</div>';
    return;
  }

  el.watchlistList.innerHTML = items
    .map(
      (team) => `
      <article class="watch-row" data-team-id="${team.id}">
        <header>
          <strong>${team.teamNumber} ${team.name}${myTeam ? ` • Compat ${num(compatibilityScore(myTeam, team), 1)}%` : ""}</strong>
          <div class="row-actions"><button class="view-team">View</button><button class="watch-toggle">Remove</button></div>
        </header>
        <div class="team-meta"><span>${team.country}</span><span>${team.region}</span><span>Fit ${num(team.fitScore, 1)}</span><span>EPA ${num(team.epa, 1)}</span></div>
      </article>
    `
    )
    .join("");
}

function compatibilityScore(myTeam, target) {
  const myTotal = myTeam.auto + myTeam.teleop + myTeam.endgame;
  const targetTotal = (target.autoPoints ?? 0) + (target.teleopPoints ?? 0) + (target.endgamePoints ?? 0);
  const totalGap = Math.abs(myTotal - targetTotal);
  const consistencyGap = Math.abs(myTeam.consistency - (target.consistency ?? 0));
  const penaltyGap = Math.abs(myTeam.penalties - (target.penaltiesPerMatch ?? 0));

  const score = clamp(
    100 -
      totalGap * 0.55 -
      consistencyGap * 0.3 -
      penaltyGap * 14,
    0,
    100
  );

  return score;
}

function getMyTeamProfile() {
  const profile = {
    name: el.myteamName.value.trim() || "My Team",
    auto: Number(el.myteamAuto.value),
    teleop: Number(el.myteamTeleop.value),
    endgame: Number(el.myteamEndgame.value),
    consistency: Number(el.myteamConsistency.value),
    penalties: Number(el.myteamPenalties.value)
  };
  const required = [profile.auto, profile.teleop, profile.endgame, profile.consistency, profile.penalties];
  const valid = required.every((v) => Number.isFinite(v));
  return valid ? profile : null;
}

function runMyTeamCompatibility() {
  const selectedId = el.myteamTarget.value || state.selectedTeam;
  const selected = state.teams.find((team) => team.id === selectedId);
  if (!selected) {
    el.myteamOutput.textContent = "Select a target team (watchlist) first.";
    return;
  }
  if (!selected.statsLoaded) {
    el.myteamOutput.textContent = "Loading selected team live stats. Try again in a moment.";
    ensureTeamStats(selected.id).then((loaded) => {
      if (loaded) {
        renderTeamList();
        renderWatchlist();
        renderTeamDetail(selected.id);
      }
    });
    return;
  }

  const myTeam = getMyTeamProfile();
  if (!myTeam) {
    el.myteamOutput.textContent = "Fill in all numeric fields to generate a compatibility report.";
    return;
  }

  const score = compatibilityScore(myTeam, selected);
  const tier = score >= 80 ? "Excellent Alliance Fit" : score >= 65 ? "Good Alliance Fit" : score >= 50 ? "Situational Fit" : "Low Fit";
  const myTotal = myTeam.auto + myTeam.teleop + myTeam.endgame;
  const targetTotal = (selected.autoPoints ?? 0) + (selected.teleopPoints ?? 0) + (selected.endgamePoints ?? 0);
  const offenseComment =
    myTotal >= targetTotal ? "Your offense profile can carry equal or higher scoring load." : "Target team likely contributes more total offense.";

  el.myteamOutput.innerHTML = `
    <div class="compare-panel">
      <strong>${myTeam.name} vs ${selected.teamNumber} ${selected.name}</strong>
      <div class="team-meta"><span>Compatibility ${num(score, 1)}</span><span>${tier}</span></div>
      <p class="team-meta">${offenseComment}</p>
      <div class="team-meta"><span>My Total ${num(myTotal, 1)}</span><span>Target Total ${num(targetTotal, 1)}</span><span>My Penalties ${num(myTeam.penalties, 2)}</span></div>
      <p class="team-meta">Scoring basis: total scoring gap + consistency gap + penalties gap. Higher % means cleaner and more balanced pairing.</p>
    </div>
  `;
}

function toggleWatchlist(teamId) {
  if (state.watchlist.has(teamId)) state.watchlist.delete(teamId);
  else state.watchlist.add(teamId);
  saveWatchlist();
  renderTeamList();
  renderWatchlist();
}

function resetFilters() {
  el.globalSearch.value = "";
  el.filterLeague.value = "all";
  el.filterCountry.value = "all";
  el.filterEpa.value = "";
  el.filterWinrate.value = "";
  el.filterEndgame.value = "all";
  el.filterAutoSpecialist.checked = false;
  el.filterLowPenalty.checked = false;
}

function renderEverything() {
  renderOverview();
  renderRankings();
  renderTeamList();
  renderWatchlist();

  if (state.selectedTeam) renderTeamDetail(state.selectedTeam);
}

function refreshFilterOptions() {
  const countries = [...new Set(state.teams.map((team) => team.country))].sort();
  const leagues = MOKS_LEAGUES;

  setSelectOptions(el.filterCountry, countries);
  setSelectOptions(el.rankingCountry, countries);
  setSelectOptions(el.filterLeague, leagues);
  setSelectOptions(el.rankingLeague, leagues);
}

function applyTeamDataset(teams) {
  state.teams = uniqueTeamsById(teams);
  const validIds = new Set(state.teams.map((team) => team.id));
  state.watchlist = new Set([...state.watchlist].filter((id) => validIds.has(id)));
  state.awardsByTeam = Object.fromEntries(
    Object.entries(state.awardsByTeam).filter(([id]) => validIds.has(id))
  );
  saveWatchlist();
  state.selectedTeam = state.teams[0]?.id || null;
  refreshFilterOptions();
  resetFilters();
  renderEverything();
  if (state.selectedTeam) renderTeamDetail(state.selectedTeam);
}

async function fetchQuickStatsChunk(teamNumbers, season) {
  const params = new URLSearchParams({
    season: String(season),
    numbers: teamNumbers.join(",")
  });
  const response = await fetch(`/api/quick-stats?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.details || payload.error || "Quick-stats fetch failed");
  return payload.stats || {};
}

async function fetchOfficialTeamSummary(teamNumber, season) {
  const params = new URLSearchParams({
    season: String(season),
    teamNumber: String(teamNumber)
  });
  const response = await fetch(`/api/official/team-summary?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.details || payload.error || "Official summary fetch failed");
  return payload.summary || {};
}

async function fetchTeamAwards(teamNumber, season) {
  const params = new URLSearchParams({
    season: String(season),
    teamNumber: String(teamNumber)
  });
  const response = await fetch(`/api/team-awards?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.details || payload.error || "Awards fetch failed");
  return Array.isArray(payload.awards) ? payload.awards : [];
}

async function tryLoadMissingTeamFromQuery(query) {
  const trimmed = query.trim();
  if (!/^\d{3,6}$/.test(trimmed)) return;
  const teamNumber = Number(trimmed);
  if (state.teams.some((team) => team.teamNumber === teamNumber)) return;
  if (state.loadingTeamNumbers.has(teamNumber)) return;

  state.loadingTeamNumbers.add(teamNumber);
  try {
    const response = await fetch(`/api/team?number=${encodeURIComponent(teamNumber)}`);
    const payload = await response.json();
    if (!response.ok || !payload.team) return;
    const mapped = mapFtcScoutTeam(payload.team, state.teams.length + 1);
    state.teams = uniqueTeamsById([...state.teams, mapped]);
    refreshFilterOptions();
    renderEverything();
    el.dataStatus.textContent = `Added missing team ${teamNumber} from FTCScout`;
  } catch (error) {
    // ignore fetch errors for missing team lookup
  } finally {
    state.loadingTeamNumbers.delete(teamNumber);
  }
}

async function ensureTeamStats(teamId) {
  if (!state.liveMode) return false;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return false;
  if (team.statsLoaded) return true;
  const season = Number(el.seasonInput.value || state.season || getDefaultSeason());
  try {
    const statsMap = await fetchQuickStatsChunk([team.teamNumber], season);
    const stats = statsMap[String(team.teamNumber)];
    if (stats) {
      state.teams = state.teams.map((item) => (item.id === team.id ? mergeQuickStats(item, stats) : item));
      return true;
    }
  } catch (error) {
    // fall through to official API fallback
  }

  try {
    const official = await fetchOfficialTeamSummary(team.teamNumber, season);
    if (!official || !Object.keys(official).length) return false;
    state.teams = state.teams.map((item) => (item.id === team.id ? mergeQuickStats(item, official) : item));
    return true;
  } catch (error) {
    // Keep base team identity data if both sources are unavailable.
    return false;
  }
}

async function ensureTeamAwards(teamId) {
  if (!state.liveMode) return [];
  if (state.awardsByTeam[teamId]) return state.awardsByTeam[teamId];
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return [];
  const season = Number(el.seasonInput.value || state.season || getDefaultSeason());
  try {
    const awards = await fetchTeamAwards(team.teamNumber, season);
    state.awardsByTeam[teamId] = awards;
    return awards;
  } catch (error) {
    state.awardsByTeam[teamId] = [{ _error: error.message || "Awards unavailable" }];
    return state.awardsByTeam[teamId];
  }
}

async function prefetchTeamStats(teamIds, limit = 60) {
  if (!state.liveMode) return;
  const season = Number(el.seasonInput.value || state.season || getDefaultSeason());
  const ids = teamIds.slice(0, limit);
  const numbers = ids
    .map((id) => state.teams.find((t) => t.id === id))
    .filter((t) => t && !t.statsLoaded)
    .map((t) => t.teamNumber)
    .filter((n) => Number.isFinite(n));
  if (!numbers.length) return;

  const chunkSize = 40;
  for (let i = 0; i < numbers.length; i += chunkSize) {
    const chunk = numbers.slice(i, i + chunkSize);
    try {
      const statsMap = await fetchQuickStatsChunk(chunk, season);
      state.teams = state.teams.map((team) => {
        const stats = statsMap[String(team.teamNumber)];
        return stats ? mergeQuickStats(team, stats) : team;
      });
    } catch (error) {
      // non-blocking prefetch
    }
  }
  renderEverything();
}

async function hydrateAllTeamsStats() {
  if (!state.liveMode || state.hydratingAllStats) return;
  state.hydratingAllStats = true;
  const season = Number(el.seasonInput.value || state.season || getDefaultSeason());
  const numbers = state.teams.map((t) => t.teamNumber).filter((n) => Number.isFinite(n));
  const chunkSize = 40;
  let done = 0;

  for (let i = 0; i < numbers.length; i += chunkSize) {
    const chunk = numbers.slice(i, i + chunkSize);
    try {
      const statsMap = await fetchQuickStatsChunk(chunk, season);
      state.teams = state.teams.map((team) => {
        const stats = statsMap[String(team.teamNumber)];
        return stats ? mergeQuickStats(team, stats) : team;
      });
    } catch (error) {
      // continue through all chunks
    }
    done += chunk.length;
    if (done % 200 === 0 || done >= numbers.length) {
      el.dataStatus.textContent = `Hydrating team stats ${done}/${numbers.length} (DECODE)`;
      renderEverything();
    }
  }

  state.hydratingAllStats = false;
  el.dataStatus.textContent = `FTCScout DECODE loaded with stats for ${numbers.length} teams`;
  renderEverything();
}

async function loadFtcScoutLiveData() {
  el.dataStatus.textContent = "Loading FTCScout live data...";
  try {
    const season = Number(el.seasonInput.value || state.season || getDefaultSeason());
    state.season = season;
    localStorage.setItem(LIVE_SEASON_KEY, String(season));
    const response = await fetch(`/api/teams?season=${encodeURIComponent(season)}&includeRecords=1`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.details || payload.error || "API request failed");
    const rows = Array.isArray(payload.teams) ? payload.teams : [];
    if (!rows.length) throw new Error("No live teams");
    const mapped = rows.map((row, idx) => mapFtcScoutTeam(row, idx));
    const seasonRecords = payload.seasonRecords || {};
    const enriched = mapped.map((team) => mergeDecodeRecord(team, seasonRecords[String(team.teamNumber)]));
    state.liveMode = true;
    state.source = "live";
    applyTeamDataset(enriched);
    const initialIds = state.teams.slice(0, 600).map((t) => t.id);
    prefetchTeamStats(initialIds, 600);
    hydrateAllTeamsStats();
    const loadedDate = payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleString() : "just now";
    const scopeNote = payload.scopeApplied === "ALL_FALLBACK" ? " (MO/KS filter fallback used)" : "";
    el.dataStatus.textContent = `FTCScout DECODE teams loaded (${enriched.length}, ${loadedDate})${scopeNote}. Hydrating stats...`;
  } catch (error) {
    state.liveMode = false;
    state.source = "none";
    state.teams = [];
    state.selectedTeam = null;
    renderEverything();
    el.dataStatus.textContent = `FTCScout live unavailable (${error.message}). Click Load FTCScout Live Data to retry.`;
  }
}

function bindEvents() {
  el.navList.addEventListener("click", (event) => {
    const btn = event.target.closest(".nav-btn");
    if (!btn) return;
    switchView(btn.dataset.view);
  });

  el.clearFilters.addEventListener("click", () => {
    resetFilters();
    renderEverything();
  });

  [el.filterLeague, el.filterCountry, el.filterEpa, el.filterWinrate, el.filterEndgame, el.filterAutoSpecialist, el.filterLowPenalty]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("input", renderEverything));

  [el.filterLeague, el.filterCountry, el.filterEndgame, el.filterAutoSpecialist, el.filterLowPenalty]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("change", renderEverything));

  el.globalSearch.addEventListener("input", () => {
    if (el.globalSearch.value.trim()) switchView("teams");
    renderEverything();
    if (state.liveMode) tryLoadMissingTeamFromQuery(el.globalSearch.value);
  });

  [el.rankingSort, el.rankingLeague, el.rankingCountry].filter(Boolean).forEach((node) => node.addEventListener("input", renderRankings));
  [el.rankingSort, el.rankingLeague, el.rankingCountry].filter(Boolean).forEach((node) => node.addEventListener("change", renderRankings));
  el.runCompare.addEventListener("click", renderComparison);
  el.compareA.addEventListener("change", renderComparison);
  el.compareB.addEventListener("change", renderComparison);
  el.myteamReport.addEventListener("click", runMyTeamCompatibility);
  [el.myteamName, el.myteamAuto, el.myteamTeleop, el.myteamEndgame, el.myteamConsistency, el.myteamPenalties].forEach(
    (node) => node.addEventListener("input", renderWatchlist)
  );

  document.body.addEventListener("click", (event) => {
    const row = event.target.closest("[data-team-id]");
    if (!row) return;
    const teamId = row.dataset.teamId;

    if (event.target.closest(".watch-toggle")) {
      toggleWatchlist(teamId);
      return;
    }

    if (event.target.closest(".view-team") || row.classList.contains("rank-row") || row.classList.contains("target-row")) {
      switchView("teams");
      renderTeamDetail(teamId);
    }
  });

  el.jsonUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.teams) ? parsed.teams : [];
      if (!rows.length) throw new Error("No team records found");
      state.liveMode = false;
      applyTeamDataset(rows.map((row, idx) => normalizeImportedTeam(row, idx)));
      el.dataStatus.textContent = `Imported ${state.teams.length} teams`;
    } catch (error) {
      el.dataStatus.textContent = "Import failed: expected a JSON array of teams";
    }

    el.jsonUpload.value = "";
  });

  el.loadLive.addEventListener("click", () => {
    loadFtcScoutLiveData();
  });

  el.seasonInput.addEventListener("change", () => {
    const season = Number(el.seasonInput.value || getDefaultSeason());
    if (Number.isFinite(season)) {
      state.season = season;
      localStorage.setItem(LIVE_SEASON_KEY, String(season));
    }
  });
}

async function init() {
  el.rankingSort.innerHTML = rankingMetrics
    .map((metric) => `<option value="${metric.value}">${metric.label}</option>`)
    .join("");
  el.rankingSort.value = "opr";

  if (!state.season) state.season = getDefaultSeason();
  el.seasonInput.value = String(state.season);
  applyTeamDataset([]);
  bindEvents();
  await loadFtcScoutLiveData();
}

init();
