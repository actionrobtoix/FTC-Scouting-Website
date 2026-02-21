const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = 3000;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const FTCSCOUT_BASE = "https://api.ftcscout.org/rest/v1";
const LIVE_CACHE_MS = 10 * 60 * 1000;
const TEAM_SEARCH_LIMIT = 1000;
const REQUIRED_TEAM_NUMBERS = [19448, 23250, 25779];
const RECORDS_BASE = "https://ftcscout.j5155.page";
const OFFICIAL_BASE = "https://ftc-api.firstinspires.org/v2.0";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json"
};

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

let liveCache = {
  timestamp: 0,
  teams: []
};
const decodeRecordsCache = new Map();

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.teams)) return payload.teams;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function flattenNumericValues(obj, out = {}, prefix = "") {
  if (!obj || typeof obj !== "object") return out;
  Object.entries(obj).forEach(([key, value]) => {
    const k = `${prefix}${key}`.toLowerCase();
    if (value === null || value === undefined) return;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[k] = value;
      return;
    }
    if (typeof value === "string") {
      const n = Number(value);
      if (Number.isFinite(n)) out[k] = n;
      return;
    }
    if (typeof value === "object") {
      flattenNumericValues(value, out, `${k}_`);
    }
  });
  return out;
}

function pickByCandidates(flat, candidates = [], regexes = []) {
  for (const c of candidates) {
    const v = flat[c.toLowerCase()];
    if (Number.isFinite(v)) return v;
  }
  const keys = Object.keys(flat);
  for (const r of regexes) {
    const key = keys.find((k) => r.test(k));
    if (key && Number.isFinite(flat[key])) return flat[key];
  }
  return null;
}

function normalizeStatsPayload(payload) {
  const source = payload.quick_stats || payload.quickStats || payload.stats || payload;
  const flat = flattenNumericValues(source);

  const wins = pickByCandidates(flat, ["wins", "record_wins"], [/(^|_)wins$/]);
  const losses = pickByCandidates(flat, ["losses", "record_losses"], [/(^|_)loss(es)?$/]);
  const ties = pickByCandidates(flat, ["ties", "record_ties"], [/(^|_)ties$/]);
  const winRateRaw = pickByCandidates(flat, ["win_rate", "win_pct", "record_win_pct"], [/win.*pct/, /win.*rate/]);
  const win_rate = winRateRaw !== null ? (winRateRaw > 1 ? winRateRaw / 100 : winRateRaw) : null;

  const auto_avg = pickByCandidates(
    flat,
    ["auto_avg", "avg_auto", "auto_points_avg", "autoopr", "auto_point_avg", "auto_value"],
    [/auto.*avg/, /auto.*opr/, /^auto_value$/]
  );
  const teleop_avg = pickByCandidates(
    flat,
    ["teleop_avg", "avg_teleop", "teleop_points_avg", "teleopopr", "driver_avg", "dc_value", "driver_controlled_value"],
    [/teleop.*avg/, /teleop.*opr/, /driver.*avg/, /^dc_value$/, /driver.*controlled.*value/]
  );
  let endgame_avg = pickByCandidates(
    flat,
    ["endgame_avg", "end_game_avg", "avg_endgame", "endgame_points_avg", "end_game_points_avg", "endgameopr", "end_game_opr", "eg_value"],
    [/end.?game.*avg/, /end.?game.*opr/, /^eg_value$/]
  );
  const total_avg = pickByCandidates(flat, ["total_avg", "avg_total", "np_avg", "avg_np", "tot_value"], [/total.*avg/, /np.*avg/, /^tot_value$/]);
  const np_opr = pickByCandidates(flat, ["np_opr", "opr", "total_opr", "tot_value"], [/np.*opr/, /(^|_)opr$/, /^tot_value$/]);
  const auto_max = pickByCandidates(flat, ["auto_max", "max_auto"], [/auto.*max/]);
  const teleop_max = pickByCandidates(flat, ["teleop_max", "max_teleop"], [/teleop.*max/]);
  const total_max = pickByCandidates(flat, ["total_max", "max_total", "np_max"], [/total.*max/, /np.*max/]);
  const std_total = pickByCandidates(flat, ["std_total", "stddev_total"], [/std.*total/, /stdev.*total/]);
  const penalties_per_match = pickByCandidates(flat, ["penalties_per_match", "avg_penalties"], [/penalt.*avg/, /penalt.*match/]);
  const double_park_rate = pickByCandidates(flat, ["double_park_rate", "doubleparkrate"], [/double.*park/]);
  const single_park_rate = pickByCandidates(flat, ["single_park_rate", "singleparkrate"], [/single.*park/]);
  const climb_rate = pickByCandidates(flat, ["climb_rate", "hang_rate", "ascent_rate"], [/climb.*rate/, /hang.*rate/, /ascent.*rate/]);
  if (!Number.isFinite(endgame_avg) && Number.isFinite(total_avg) && Number.isFinite(auto_avg) && Number.isFinite(teleop_avg)) {
    endgame_avg = Math.max(0, total_avg - auto_avg - teleop_avg);
  }

  return {
    wins,
    losses,
    ties,
    win_rate,
    auto_avg,
    teleop_avg,
    endgame_avg,
    total_avg,
    np_opr,
    auto_max,
    teleop_max,
    total_max,
    std_total,
    penalties_per_match,
    double_park_rate,
    single_park_rate,
    climb_rate,
    shooting_zone: source.shooting_zone || source.shootingZone || null,
    raw: source
  };
}

function getOfficialCredentials(req) {
  const user = req.headers["x-ftc-user"] || process.env.FTC_API_USER || "";
  const key = req.headers["x-ftc-key"] || process.env.FTC_API_KEY || "";
  const token = req.headers["x-ftc-token"] || process.env.FTC_API_TOKEN || "";
  return { user: String(user || ""), key: String(key || ""), token: String(token || "") };
}

function hasOfficialCredentials(creds) {
  return Boolean((creds.user && creds.key) || creds.token);
}

function officialAuthHeader(creds) {
  if (creds.token) return `Basic ${creds.token}`;
  const token = Buffer.from(`${creds.user}:${creds.key}`).toString("base64");
  return `Basic ${token}`;
}

async function officialFetch(pathname, creds) {
  const response = await fetchWithTimeout(`${OFFICIAL_BASE}${pathname}`, {
    headers: {
      Authorization: officialAuthHeader(creds),
      Accept: "application/json",
      "User-Agent": "ActionScout/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Official FTC API ${pathname} returned ${response.status}`);
  }
  return response.json();
}

function aggregateOfficialRankings(rankRows) {
  const agg = {
    wins: 0,
    losses: 0,
    ties: 0,
    matches: 0,
    ranking_points: 0,
    auto_avg: null,
    teleop_avg: null,
    endgame_avg: null
  };
  let scoreBuckets = 0;
  rankRows.forEach((row) => {
    const wins = Number(row.wins ?? row.qualWins ?? 0);
    const losses = Number(row.losses ?? row.qualLosses ?? 0);
    const ties = Number(row.ties ?? row.qualTies ?? 0);
    agg.wins += Number.isFinite(wins) ? wins : 0;
    agg.losses += Number.isFinite(losses) ? losses : 0;
    agg.ties += Number.isFinite(ties) ? ties : 0;
    agg.matches += (Number.isFinite(wins) ? wins : 0) + (Number.isFinite(losses) ? losses : 0) + (Number.isFinite(ties) ? ties : 0);

    const sort1 = Number(row.sortOrder1 ?? row.rp ?? row.rankingPoints ?? 0);
    if (Number.isFinite(sort1)) agg.ranking_points += sort1;

    const maybeAuto = Number(row.sortOrder2 ?? row.autoPoints ?? row.auto);
    const maybeTele = Number(row.sortOrder3 ?? row.teleopPoints ?? row.teleop);
    const maybeEnd = Number(row.sortOrder4 ?? row.endgamePoints ?? row.endgame);
    if (Number.isFinite(maybeAuto) || Number.isFinite(maybeTele) || Number.isFinite(maybeEnd)) {
      scoreBuckets += 1;
      agg.auto_avg = (agg.auto_avg || 0) + (Number.isFinite(maybeAuto) ? maybeAuto : 0);
      agg.teleop_avg = (agg.teleop_avg || 0) + (Number.isFinite(maybeTele) ? maybeTele : 0);
      agg.endgame_avg = (agg.endgame_avg || 0) + (Number.isFinite(maybeEnd) ? maybeEnd : 0);
    }
  });

  if (scoreBuckets > 0) {
    agg.auto_avg /= scoreBuckets;
    agg.teleop_avg /= scoreBuckets;
    agg.endgame_avg /= scoreBuckets;
  } else {
    agg.auto_avg = null;
    agg.teleop_avg = null;
    agg.endgame_avg = null;
  }

  return agg;
}

async function fetchOfficialTeamSummary(season, teamNumber, creds) {
  const eventsPayload = await officialFetch(`/${season}/events?teamNumber=${encodeURIComponent(teamNumber)}`, creds);
  const events = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
  const eventCodes = events.map((e) => e.code || e.eventCode).filter(Boolean).slice(0, 40);
  if (!eventCodes.length) return {};

  const rows = [];
  for (const code of eventCodes) {
    try {
      const rankingPayload = await officialFetch(`/${season}/rankings/${encodeURIComponent(code)}?teamNumber=${encodeURIComponent(teamNumber)}`, creds);
      const rankingRows = Array.isArray(rankingPayload.rankings) ? rankingPayload.rankings : [];
      rankingRows.forEach((r) => rows.push(r));
    } catch (error) {
      // continue across events
    }
  }

  if (!rows.length) return {};
  const agg = aggregateOfficialRankings(rows);
  const winRate = agg.matches ? agg.wins / agg.matches : null;
  const totalAvg =
    (Number.isFinite(agg.auto_avg) ? agg.auto_avg : 0) +
    (Number.isFinite(agg.teleop_avg) ? agg.teleop_avg : 0) +
    (Number.isFinite(agg.endgame_avg) ? agg.endgame_avg : 0);

  return {
    wins: agg.wins,
    losses: agg.losses,
    ties: agg.ties,
    win_rate: winRate,
    auto_avg: agg.auto_avg,
    teleop_avg: agg.teleop_avg,
    endgame_avg: agg.endgame_avg,
    total_avg: totalAvg || null,
    np_opr: null,
    ranking_points: agg.ranking_points || null
  };
}

async function fetchOfficialTeamAwards(season, teamNumber, creds) {
  const payload = await officialFetch(`/${season}/awards/${encodeURIComponent(teamNumber)}`, creds);
  const awards = Array.isArray(payload.awards) ? payload.awards : [];
  return awards.map((a) => ({
    name: a.name || a.awardName || a.award || `Award ${a.awardId ?? ""}`.trim(),
    eventCode: a.eventCode || a.event?.code || "",
    eventName: a.eventName || a.event?.name || "",
    person: a.person || ""
  }));
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.\-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRecordsRows(html) {
  const rows = [];
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let headers = [];

  const indexByHeader = (patterns = []) => {
    for (let i = 0; i < headers.length; i += 1) {
      const h = headers[i];
      if (patterns.some((p) => p.test(h))) return i;
    }
    return -1;
  };

  rowMatches.forEach((rowHtml) => {
    const thCells = [...rowHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1]).toLowerCase());
    if (thCells.length) {
      headers = thCells;
      return;
    }

    const tdCells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (!tdCells.length || !headers.length) return;

    const teamIndex = indexByHeader([/team/, /number/]);
    const npOprIndex = indexByHeader([/np.*opr/, /total.*np/, /total.*opr/]);
    const autoIndex = indexByHeader([/^auto/, /auto.*opr/, /auto.*avg/]);
    const teleopIndex = indexByHeader([/teleop/, /driver.*controlled/]);
    const endgameIndex = indexByHeader([/endgame/, /end.*game/]);
    const npAvgIndex = indexByHeader([/np.*avg/, /total.*avg/]);
    const recordIndex = indexByHeader([/record/, /w-?l-?t/]);

    const teamCell = tdCells[teamIndex >= 0 ? teamIndex : 1] || "";
    const teamMatch = teamCell.match(/(\d{1,6})\s+(.+)/);
    if (!teamMatch) return;

    const teamNumber = Number(teamMatch[1]);
    const name = teamMatch[2].trim();
    const np_opr = parseNumber(tdCells[npOprIndex]);
    const auto_opr = parseNumber(tdCells[autoIndex]);
    const teleop_opr = parseNumber(tdCells[teleopIndex]);
    const endgame_opr = parseNumber(tdCells[endgameIndex]);
    const np_avg = parseNumber(tdCells[npAvgIndex]);
    const recordText = tdCells[recordIndex >= 0 ? recordIndex : tdCells.length - 1] || "";
    const rec = recordText.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
    const wins = rec ? Number(rec[1]) : null;
    const losses = rec ? Number(rec[2]) : null;
    const ties = rec ? Number(rec[3]) : null;

    rows.push({
      teamNumber,
      name,
      np_opr,
      auto_opr,
      teleop_opr,
      endgame_opr,
      np_avg,
      wins,
      losses,
      ties
    });
  });
  return rows;
}

function mergeBestRecords(rows) {
  const byTeam = {};
  rows.forEach((row) => {
    const key = String(row.teamNumber);
    if (!byTeam[key]) {
      byTeam[key] = row;
      return;
    }
    const prev = byTeam[key];
    const prevScore = Number.isFinite(prev.np_opr) ? prev.np_opr : -Infinity;
    const nextScore = Number.isFinite(row.np_opr) ? row.np_opr : -Infinity;
    if (nextScore > prevScore) byTeam[key] = row;
  });
  return byTeam;
}

async function fetchDecodeSeasonRecords(season) {
  const cacheKey = String(season);
  const cached = decodeRecordsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LIVE_CACHE_MS) {
    return cached.data;
  }

  const allRows = [];
  for (let page = 1; page <= 40; page += 1) {
    const url = `${RECORDS_BASE}/records/${encodeURIComponent(season)}/teams?page=${page}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "ActionScout/1.0"
      }
    });
    if (!response.ok) break;
    const html = await response.text();
    const rows = parseRecordsRows(html);
    if (!rows.length) break;
    allRows.push(...rows);
  }

  const merged = mergeBestRecords(allRows);
  decodeRecordsCache.set(cacheKey, { timestamp: Date.now(), data: merged });
  return merged;
}

async function fetchFtcScoutTeamsFrom(startUrl) {
  const response = await fetchWithTimeout(startUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ActionScout/1.0"
    }
  });
  if (!response.ok) throw new Error(`FTCScout returned ${response.status}`);
  const payload = await response.json();
  const teams = extractArray(payload);
  if (!teams.length) throw new Error("FTCScout returned no teams");
  return teams;
}

async function fetchFtcScoutTeams() {
  if (Date.now() - liveCache.timestamp < LIVE_CACHE_MS && liveCache.teams.length) {
    return liveCache.teams;
  }
  const queries = [
    "",
    ..."abcdefghijklmnopqrstuvwxyz".split(""),
    ..."0123456789".split("")
  ];
  const merged = new Map();
  let lastError = null;
  let hadSuccess = false;

  for (const query of queries) {
    const qs = new URLSearchParams();
    qs.set("limit", String(TEAM_SEARCH_LIMIT));
    if (query) qs.set("searchText", query);
    const url = `${FTCSCOUT_BASE}/teams/search?${qs.toString()}`;
    try {
      const teams = await fetchFtcScoutTeamsFrom(url);
      hadSuccess = true;
      teams.forEach((team) => {
        const number = team.team_number ?? team.number ?? team.teamNumber;
        if (number !== undefined && number !== null) merged.set(String(number), team);
      });
    } catch (error) {
      lastError = error;
    }
  }

  for (const teamNumber of REQUIRED_TEAM_NUMBERS) {
    if (merged.has(String(teamNumber))) continue;
    try {
      const response = await fetchWithTimeout(`${FTCSCOUT_BASE}/teams/${teamNumber}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ActionScout/1.0"
        }
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const one = Array.isArray(payload) ? payload[0] : payload;
      if (one && (one.team_number || one.number || one.teamNumber)) {
        merged.set(String(teamNumber), one);
      }
    } catch (error) {
      // keep trying other required teams
    }
  }

  if (!merged.size) {
    if (liveCache.teams.length) return liveCache.teams;
    if (hadSuccess) throw new Error("FTCScout search returned no teams");
    throw lastError || new Error("Unknown FTCScout fetch error");
  }
  const teams = [...merged.values()].sort((a, b) => {
    const an = Number(a.team_number ?? a.number ?? a.teamNumber ?? 0);
    const bn = Number(b.team_number ?? b.number ?? b.teamNumber ?? 0);
    return an - bn;
  });
  liveCache = { timestamp: Date.now(), teams };
  return teams;
}

function isMoKsTeam(team) {
  const country = String(team.country || team.country_name || team.countryName || "").trim().toUpperCase();
  if (country && country !== "USA" && country !== "US" && country !== "UNITED STATES") return false;

  const stateRaw = String(team.state || team.state_prov || team.stateProv || "").trim().toUpperCase();
  const regionCode = String(team.region_code || team.regionCode || "").trim().toUpperCase();
  const region = String(team.region || "").trim().toUpperCase();

  const moStates = new Set(["MO", "MISSOURI"]);
  const ksStates = new Set(["KS", "KANSAS"]);
  if (moStates.has(stateRaw) || ksStates.has(stateRaw)) return true;
  if (regionCode === "USMO" || regionCode === "USKS") return true;
  if (region === "MO" || region === "KS" || region === "MISSOURI" || region === "KANSAS") return true;

  return false;
}

async function fetchQuickStatForTeam(teamNumber, season) {
  const seasonNum = Number(season);
  const seasonCandidates = [seasonNum, seasonNum - 1, seasonNum - 2, seasonNum + 1]
    .filter((v, i, arr) => Number.isFinite(v) && v > 2010 && arr.indexOf(v) === i);
  const attempts = [];
  seasonCandidates.forEach((s) => {
    attempts.push(`${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}/quick-stats?season=${encodeURIComponent(s)}`);
    attempts.push(`${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}/quickstats?season=${encodeURIComponent(s)}`);
    attempts.push(`${FTCSCOUT_BASE}/team/${encodeURIComponent(teamNumber)}/quick-stats?season=${encodeURIComponent(s)}`);
  });
  attempts.push(`${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}/quick-stats`);
  attempts.push(`${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}/quickstats`);
  attempts.push(`${FTCSCOUT_BASE}/team/${encodeURIComponent(teamNumber)}/quick-stats`);
  let lastStatus = null;

  for (const url of attempts) {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ActionScout/1.0"
      }
    });
    if (response.ok) {
      const payload = await response.json();
      const body = payload.quick_stats || payload.quickStats || payload;
      if (body && Object.keys(body).length) return normalizeStatsPayload(payload);
    }
    lastStatus = response.status;
  }
  // Fallback: aggregate event participation stats for this season if quick-stats routes are unavailable.
  const eventUrl = `${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}/events/${encodeURIComponent(season)}`;
  const eventResponse = await fetchWithTimeout(eventUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ActionScout/1.0"
    }
  });
  if (eventResponse.ok) {
    const payload = await eventResponse.json();
    const rows = extractArray(payload);
    if (rows.length) {
      const numericAgg = {};
      const numericCounts = {};
      rows.forEach((row) => {
        const source = row.stats || row.quick_stats || row.quickStats || row;
        Object.entries(source).forEach(([key, value]) => {
          const n = Number(value);
          if (!Number.isFinite(n)) return;
          numericAgg[key] = (numericAgg[key] || 0) + n;
          numericCounts[key] = (numericCounts[key] || 0) + 1;
        });
      });
      const averaged = {};
      Object.keys(numericAgg).forEach((key) => {
        averaged[key] = numericAgg[key] / Math.max(numericCounts[key], 1);
      });
      return normalizeStatsPayload(averaged);
    }
  }

  throw new Error(`Quick-stats ${teamNumber} returned ${lastStatus}`);
}

async function fetchQuickStatsBatch(teamNumbers, season) {
  const stats = {};
  const concurrency = 6;
  for (let i = 0; i < teamNumbers.length; i += concurrency) {
    const chunk = teamNumbers.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((num) => fetchQuickStatForTeam(num, season)));
    settled.forEach((entry, idx) => {
      const num = chunk[idx];
      if (entry.status === "fulfilled") stats[String(num)] = entry.value;
    });
  }
  return stats;
}

async function fetchOneTeam(teamNumber) {
  const directUrl = `${FTCSCOUT_BASE}/teams/${encodeURIComponent(teamNumber)}`;
  const searchUrl = `${FTCSCOUT_BASE}/teams/search?limit=5&searchText=${encodeURIComponent(String(teamNumber))}`;
  const attempts = [directUrl, searchUrl];

  for (const url of attempts) {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ActionScout/1.0"
      }
    });
    if (!response.ok) continue;
    const payload = await response.json();
    const rows = extractArray(payload);
    const one = rows.length ? rows[0] : payload;
    const number = one && (one.team_number ?? one.number ?? one.teamNumber);
    if (String(number) === String(teamNumber)) return one;
  }
  return null;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/teams") {
    try {
      const season = Number(url.searchParams.get("season") || 2025);
      const includeRecords = url.searchParams.get("includeRecords") === "1";
      const allTeams = await fetchFtcScoutTeams();
      let teams = allTeams.filter(isMoKsTeam);
      let scopeApplied = "MO/KS";
      if (!teams.length) {
        teams = allTeams;
        scopeApplied = "ALL_FALLBACK";
      }
      let seasonRecords = {};
      if (includeRecords) {
        try {
          const rawRecords = await fetchDecodeSeasonRecords(season);
          const filteredRecords = {};
          teams.forEach((team) => {
            const number = String(team.team_number ?? team.number ?? team.teamNumber ?? "");
            if (rawRecords[number]) filteredRecords[number] = rawRecords[number];
          });
          seasonRecords = filteredRecords;
        } catch (error) {
          seasonRecords = {};
        }
      }
      send(
        res,
        200,
        JSON.stringify({ source: "FTCScout", season, scopeApplied, fetchedAt: new Date().toISOString(), teams, seasonRecords }),
        "application/json"
      );
    } catch (error) {
      const details = (error && (error.cause?.message || error.message)) || "Unknown error";
      send(res, 502, JSON.stringify({ error: "Failed to fetch FTCScout teams", details }), "application/json");
    }
    return true;
  }
  if (url.pathname === "/api/quick-stats") {
    try {
      const season = Number(url.searchParams.get("season") || 0);
      const numbers = (url.searchParams.get("numbers") || "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n))
        .slice(0, 60);
      if (!season || !numbers.length) {
        send(res, 400, JSON.stringify({ error: "Missing season or team numbers" }), "application/json");
        return true;
      }
      const stats = await fetchQuickStatsBatch(numbers, season);
      send(res, 200, JSON.stringify({ season, stats }), "application/json");
    } catch (error) {
      const details = (error && (error.cause?.message || error.message)) || "Unknown error";
      send(res, 502, JSON.stringify({ error: "Failed to fetch quick-stats", details }), "application/json");
    }
    return true;
  }
  if (url.pathname === "/api/official/team-summary") {
    try {
      const season = Number(url.searchParams.get("season") || 0);
      const teamNumber = Number(url.searchParams.get("teamNumber") || 0);
      if (!season || !teamNumber) {
        send(res, 400, JSON.stringify({ error: "Missing season or teamNumber" }), "application/json");
        return true;
      }
      const creds = getOfficialCredentials(req);
      if (!hasOfficialCredentials(creds)) {
        send(res, 401, JSON.stringify({ error: "Missing official FTC API credentials" }), "application/json");
        return true;
      }
      const summary = await fetchOfficialTeamSummary(season, teamNumber, creds);
      send(res, 200, JSON.stringify({ season, teamNumber, summary }), "application/json");
    } catch (error) {
      const details = (error && (error.cause?.message || error.message)) || "Unknown error";
      send(res, 502, JSON.stringify({ error: "Failed to fetch official team summary", details }), "application/json");
    }
    return true;
  }
  if (url.pathname === "/api/team-awards") {
    try {
      const season = Number(url.searchParams.get("season") || 0);
      const teamNumber = Number(url.searchParams.get("teamNumber") || 0);
      if (!season || !teamNumber) {
        send(res, 400, JSON.stringify({ error: "Missing season or teamNumber" }), "application/json");
        return true;
      }
      const creds = getOfficialCredentials(req);
      if (!hasOfficialCredentials(creds)) {
        send(res, 401, JSON.stringify({ error: "Missing official FTC API credentials" }), "application/json");
        return true;
      }
      const awards = await fetchOfficialTeamAwards(season, teamNumber, creds);
      send(res, 200, JSON.stringify({ season, teamNumber, awards }), "application/json");
    } catch (error) {
      const details = (error && (error.cause?.message || error.message)) || "Unknown error";
      send(res, 502, JSON.stringify({ error: "Failed to fetch team awards", details }), "application/json");
    }
    return true;
  }
  if (url.pathname === "/api/team") {
    try {
      const number = Number(url.searchParams.get("number"));
      if (!Number.isFinite(number)) {
        send(res, 400, JSON.stringify({ error: "Missing team number" }), "application/json");
        return true;
      }
      const team = await fetchOneTeam(number);
      if (!team) {
        send(res, 404, JSON.stringify({ error: "Team not found" }), "application/json");
        return true;
      }
      send(res, 200, JSON.stringify({ team }), "application/json");
    } catch (error) {
      const details = (error && (error.cause?.message || error.message)) || "Unknown error";
      send(res, 502, JSON.stringify({ error: "Failed to fetch team", details }), "application/json");
    }
    return true;
  }
  return false;
}

function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = filePath.split("?")[0];
  const resolved = path.join(ROOT, filePath);

  if (!resolved.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(resolved);
    const type = MIME_TYPES[ext] || "application/octet-stream";
    send(res, 200, data, type);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (!handled) send(res, 404, "Not found");
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
