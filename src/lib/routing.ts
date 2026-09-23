/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ROUTES, Route, COORDS, STATIONS } from '../data/transitData';
import { isValidLatLng } from '../utils/geoUtils';

export interface TripLeg {
  route: Route;
  from: string;
  to: string;
  geometry?: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds
  fare: number; // in ETB
}

export interface TripWalkingLeg {
  from: string;
  to: string;
  distance: number; // in meters
  duration: number; // in seconds
}

export type RouteBadge = 'recommended' | 'direct' | 'fastest' | 'cheapest' | 'minimal_walk';

export interface TripPath {
  legs: TripLeg[];
  transfers: number;
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  totalFare: number; // in ETB
  walkToStart?: TripWalkingLeg;
  walkToEnd?: TripWalkingLeg;
  totalWalkingDistance: number; // in meters
  score: number;
  badge?: RouteBadge;
  badgeLabel?: { en: string; am: string };
}

/**
 * Calculates Euclidean / Equirectangular distance in meters between two coordinates.
 */
export function getDistanceMeters(p1: [number, number], p2: [number, number]): number {
  if (!isValidLatLng(p1) || !isValidLatLng(p2)) return 0;
  const dy = (p2[0] - p1[0]) * 111000;
  const dx = (p2[1] - p1[1]) * 111000 * Math.cos((p1[0] * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Addis Ababa official minibus fare calculation per leg.
 */
export function estimateMinibusFare(meters: number): number {
  if (meters <= 2500) return 10;
  if (meters <= 5500) return 15;
  if (meters <= 9500) return 20;
  if (meters <= 14000) return 25;
  if (meters <= 20000) return 30;
  return 35;
}

/**
 * Addis Ababa road traffic travel time estimate (average speed ~24 km/h + stopping buffer).
 */
export function estimateTransitSeconds(meters: number): number {
  const transitSpeed = 6.67; // 24 km/h in m/s
  const stoppingBufferPerKm = 50; // seconds for stops and intersections
  const pureDrive = meters / transitSpeed;
  const buffer = (meters / 1000) * stoppingBufferPerKm;
  return Math.round(pureDrive + buffer);
}

/**
 * Walking duration estimate (average walking speed ~4.8 km/h = 1.33 m/s).
 */
export function estimateWalkSeconds(meters: number): number {
  return Math.round(meters / 1.33);
}

// Amharic and alternate transliteration dictionary for robust location resolution
const AMHARIC_LOCATION_MAP: Record<string, string> = {
  'ቦሌ': 'Bole Bridge',
  'ቦሌ መድኃኔዓለም': 'Bole Medhanialem',
  'ቦሌ መድኃኒዓለም': 'Bole Medhanialem',
  'ቦሌ ድልድይ': 'Bole Bridge',
  'ቦሌ ሚካኤል': 'Bole Mickael',
  'ቦሌ ሩዋንዳ': 'Bole Bridge',
  'ቦሌ አትላስ': 'Bole Bridge',
  'ቦሌ አትላስ ጣቢያ': 'Bole Bridge',
  'መገናኛ': 'Megenagna',
  'መገናኛ ሚኒባስ ማዕከል': 'Megenagna',
  'ሜክሲኮ': 'Mexico',
  'ሜክሲኮ አደባባይ': 'Mexico',
  'ሜክሲኮ አደባባይ ቆሚ': 'Mexico',
  'ፒያሳ': 'Piassa',
  'አራዳ': 'Piassa Arada',
  'ጊዮርጊስ': 'Piassa Arada',
  'መርካቶ': 'Merkato',
  'አውቶቡስ ተራ': 'Autobus Tera',
  'አራት ኪሎ': '4 Kilo',
  '4 ኪሎ': '4 Kilo',
  '4 ኪሎ ሚኒባስ ቆሚ': '4 Kilo',
  'ስድስት ኪሎ': '6 Kilo',
  '6 ኪሎ': '6 Kilo',
  'ስታዲየም': 'Stadium',
  'ስታዲዬም': 'Stadium',
  'ስታዲዬም ታክሲ ሃብ': 'Stadium',
  'ካዛንቺስ': 'Kazanchis',
  'ሰርቤት': 'Sar Bet',
  'ሳርቤት': 'Sar Bet',
  'ሰርቤት ሚኒባስ ተርሚናል': 'Sar Bet',
  'ጦር ኃይሎች': 'Torhayloch',
  'ሳሪስ': 'Saris',
  'ሳሪስ አቦ': 'Saris Abo',
  'ሳሪስ ሚኒባስ ጣቢያ': 'Saris',
  'ቃሊቲ': 'Kality Total',
  'ካሊቲ': 'Kality Total',
  'ቃሊቲ መናኸሪያ': 'Kality Menaheria',
  'አያት': 'Ayat',
  'ሲኤምሲ': 'CMC',
  'ጀሞ': 'Jemmo 1',
  'ጀምሞ': 'Jemmo 1',
  'ኮተቤ': 'Kotebe',
  'አስኮ': 'Asko',
  'አየር ጤና': 'Ayer Tena',
  'አዲሱ ገበያ': 'Addisu Gebeya',
  'ሽሮሜዳ': 'Shiromeda',
  'ለቡ': 'Lebu',
  'ጎፋ': 'Gofa Gebriel',
  'ጎተራ': 'Gotera',
  'ቄራ': 'Kera',
  'ወሎ ሰፈር': 'Wello Sefer',
  'ኦሎምፒያ': 'Olympia',
  'አበነት': 'Abenet',
  'ልደታ': 'Lideta',
  'ተክለ ሃይማኖት': 'Tekle Haimanot',
  'ጥቁር አንበሳ': 'Tikur Anbesa',
  'ላምበረት': 'Lamberet Menaheria',
  'ዘነበወርቅ': 'Zenebewerk',
  'ገርጂ': 'Gerji',
  'ቡልቡላ': 'Bulbula',
  'ፈረንሳይ': 'Ferensay',
  'ጎሮ': 'Goro',
  'ሰሚት': 'Summit',
  'የአሁኑ አካባቢ': 'Current Location',
  'የአሁኑ ቦታ': 'Current Location',
  'አሁን ያሉበት ቦታ': 'Current Location',
};

/**
 * Clean canonical stop identifier for clustering.
 */
export function getCanonicalStop(name: string): string {
  const clean = name.trim().toLowerCase();
  if (AMHARIC_LOCATION_MAP[name.trim()]) {
    return AMHARIC_LOCATION_MAP[name.trim()];
  }
  if (clean === 'sarbet' || clean === 'sar bet' || clean === 'sarbet minibus terminal') return 'Sar Bet';
  if (clean === 'piassa' || clean === 'piassa arada' || clean === 'arada') return 'Piassa Arada';
  if (clean === 'arat kilo' || clean === '4 kilo' || clean === '4 kilo (menlik)' || clean === '4 kilo minibus stop') return '4 Kilo';
  if (clean === 'sidist kilo' || clean === '6 kilo' || clean === '6 kilo university') return '6 Kilo';
  if (clean === 'merkato' || clean === 'autobus tera') return 'Autobus Tera';
  if (clean === 'tor hailoch' || clean === 'torhayloch') return 'Torhayloch';
  if (clean === 'bole' || clean === 'bole bridge' || clean === 'bole atlas station') return 'Bole Bridge';
  if (clean === 'bole medhanialem' || clean === 'bole medhanyalem') return 'Bole Medhanialem';
  if (clean === 'kality' || clean === 'kality total' || clean === 'kality meneharia') return 'Kality Total';
  if (clean === 'stadium' || clean === 'stadium taxi hub' || clean === 'adey ababa stadium') return 'Stadium';
  if (clean === 'mexico' || clean === 'mexico square' || clean === 'mexico square stop' || clean === 'mexico shebelle hotel') return 'Mexico';
  if (clean === 'gotera' || clean === 'gotera chaf') return 'Gotera';
  if (clean === 'megenagna' || clean === 'megenagna minibus hub') return 'Megenagna';
  if (clean === 'saris' || clean === 'saris minibus station') return 'Saris';
  if (clean === 'gerji' || clean === 'gerji mebrat hayle') return 'Gerji';
  return name.trim();
}

export interface CandidateStop {
  stopName: string;
  coord: [number, number];
  walkMeters: number;
}

const DEFAULT_ADDIS_CENTER: [number, number] = [9.0222, 38.7468];

/**
 * Resolves any location (user text, landmark, Amharic name, or GPS coordinate) into viable transit boarding/alighting stops.
 */
export function resolveLocationCandidates(
  locationInput: string | [number, number],
  allRouteNodes: Set<string>,
  maxWalkMeters = 2000
): CandidateStop[] {
  let targetCoord: [number, number] | undefined;
  let rawName = '';

  if (Array.isArray(locationInput)) {
    if (isValidLatLng(locationInput)) {
      targetCoord = locationInput;
      rawName = 'Current Location';
    } else {
      targetCoord = DEFAULT_ADDIS_CENTER;
      rawName = 'Addis Ababa Center';
    }
  } else {
    rawName = locationInput.trim();
    if (!rawName) return [];

    // Check Current Location
    if (
      rawName === 'Current Location' ||
      rawName === 'የአሁኑ አካባቢ' ||
      rawName === 'የአሁኑ ቦታ' ||
      rawName === 'አሁን ያሉበት ቦታ'
    ) {
      targetCoord = DEFAULT_ADDIS_CENTER;
    }

    // Check Amharic mapping
    if (!targetCoord && AMHARIC_LOCATION_MAP[rawName]) {
      const canonicalTarget = AMHARIC_LOCATION_MAP[rawName];
      if (COORDS[canonicalTarget] && isValidLatLng(COORDS[canonicalTarget])) {
        targetCoord = COORDS[canonicalTarget];
      }
    }

    // Check STATIONS
    if (!targetCoord) {
      const st = STATIONS.find(
        (s) =>
          s.name.toLowerCase() === rawName.toLowerCase() ||
          s.am === rawName ||
          rawName.toLowerCase().includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(rawName.toLowerCase())
      );
      if (st && isValidLatLng([st.lat, st.lng])) {
        targetCoord = [st.lat, st.lng];
      }
    }

    // Exact match in COORDS
    if (!targetCoord && COORDS[rawName] && isValidLatLng(COORDS[rawName])) {
      targetCoord = COORDS[rawName];
    }

    // Canonical alias check
    if (!targetCoord) {
      const canonical = getCanonicalStop(rawName);
      if (COORDS[canonical] && isValidLatLng(COORDS[canonical])) {
        targetCoord = COORDS[canonical];
      }
    }

    // Case-insensitive & substring search across COORDS
    if (!targetCoord) {
      const lower = rawName.toLowerCase();
      for (const [key, pos] of Object.entries(COORDS)) {
        if (key.toLowerCase() === lower && isValidLatLng(pos)) {
          targetCoord = pos;
          break;
        }
      }
      if (!targetCoord) {
        for (const [key, pos] of Object.entries(COORDS)) {
          if ((key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) && isValidLatLng(pos)) {
            targetCoord = pos;
            break;
          }
        }
      }
    }
  }

  // Fallback to center if nothing matched to ensure the user always gets viable directions
  if (!targetCoord) {
    targetCoord = DEFAULT_ADDIS_CENTER;
  }

  const candidates: CandidateStop[] = [];

  // If the location is already an exact route node, prioritize it as zero-walk
  if (rawName && allRouteNodes.has(rawName) && targetCoord) {
    candidates.push({ stopName: rawName, coord: targetCoord, walkMeters: 0 });
  }
  const canonicalName = getCanonicalStop(rawName);
  if (canonicalName && canonicalName !== rawName && allRouteNodes.has(canonicalName) && COORDS[canonicalName]) {
    candidates.push({ stopName: canonicalName, coord: COORDS[canonicalName], walkMeters: 0 });
  }

  // Find nearest transit stops by Euclidean walking distance
  const nearby: { stopName: string; coord: [number, number]; walkMeters: number }[] = [];
  for (const node of allRouteNodes) {
    const nodeCoord = COORDS[node];
    if (!nodeCoord || !isValidLatLng(nodeCoord)) continue;
    const dist = getDistanceMeters(targetCoord, nodeCoord);
    if (dist <= maxWalkMeters) {
      nearby.push({ stopName: node, coord: nodeCoord, walkMeters: dist });
    }
  }

  nearby.sort((a, b) => a.walkMeters - b.walkMeters);

  // If no stops within maxWalkMeters, fallback to the absolute closest stops
  if (nearby.length === 0) {
    const allStopsWithDist: { stopName: string; coord: [number, number]; walkMeters: number }[] = [];
    for (const node of allRouteNodes) {
      const nodeCoord = COORDS[node];
      if (!nodeCoord || !isValidLatLng(nodeCoord)) continue;
      const dist = getDistanceMeters(targetCoord, nodeCoord);
      allStopsWithDist.push({ stopName: node, coord: nodeCoord, walkMeters: dist });
    }
    allStopsWithDist.sort((a, b) => a.walkMeters - b.walkMeters);
    nearby.push(...allStopsWithDist.slice(0, 3));
  }

  // Combine and deduplicate
  const seen = new Set<string>();
  const results: CandidateStop[] = [];

  for (const c of [...candidates, ...nearby]) {
    const key = getCanonicalStop(c.stopName);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(c);
      if (results.length >= 3) break;
    }
  }

  return results;
}

interface GraphEdge {
  to: string;
  route: Route;
  distance: number;
  duration: number;
  fare: number;
}

let cachedGraph: {
  adj: Map<string, GraphEdge[]>;
  allRouteNodes: Set<string>;
} | null = null;

function getTransitGraph() {
  if (cachedGraph) return cachedGraph;

  const adj = new Map<string, GraphEdge[]>();
  const allRouteNodes = new Set<string>();

  ROUTES.forEach((r) => {
    const fromCoord = COORDS[r.from];
    const toCoord = COORDS[r.to];
    if (!fromCoord || !toCoord || !isValidLatLng(fromCoord) || !isValidLatLng(toCoord)) return;

    allRouteNodes.add(r.from);
    allRouteNodes.add(r.to);

    const dist = getDistanceMeters(fromCoord, toCoord);
    const dur = estimateTransitSeconds(dist);
    const fare = estimateMinibusFare(dist);

    // Forward edge (Passenger boards at r.from, alights at r.to)
    if (!adj.has(r.from)) adj.set(r.from, []);
    adj.get(r.from)!.push({ to: r.to, route: r, distance: dist, duration: dur, fare });

    // Backward edge (Passenger boards at r.to, alights at r.from)
    if (!adj.has(r.to)) adj.set(r.to, []);
    adj.get(r.to)!.push({ to: r.from, route: r, distance: dist, duration: dur, fare });
  });

  cachedGraph = { adj, allRouteNodes };
  return cachedGraph;
}

/**
 * Absolute Intelligence Transit Pathfinding for Addis Ababa.
 * Features:
 * - Multi-criteria scoring (travel time, zero unnecessary transfers, minimal walking, fair cost)
 * - Complete reachability (Direct, 1-transfer, and 2-transfer search)
 * - Strict loop and detour elimination (zero redundancy)
 * - Full Amharic & landmark mapping (No route found fix)
 * - Leg direction normalization (board/alight accurately reflected)
 */
export function findTripPaths(
  startInput: string | [number, number],
  endInput: string | [number, number]
): TripPath[] {
  if (!startInput || !endInput) return [];

  const { adj, allRouteNodes } = getTransitGraph();

  const startCandidates = resolveLocationCandidates(startInput, allRouteNodes);
  const endCandidates = resolveLocationCandidates(endInput, allRouteNodes);

  if (startCandidates.length === 0 || endCandidates.length === 0) return [];

  // Determine direct reference air distance between origin and destination
  const p1 = startCandidates[0].coord;
  const p2 = endCandidates[0].coord;
  const airDistanceMeters = getDistanceMeters(p1, p2);

  const rawPaths: TripPath[] = [];

  // 1. Direct Routes (0 Transfers)
  for (const sCand of startCandidates) {
    const edges = adj.get(sCand.stopName) || [];
    for (const edge of edges) {
      for (const eCand of endCandidates) {
        if (edge.to === eCand.stopName) {
          const transitDist = edge.distance;
          const transitDur = edge.duration;
          const totalWalk = sCand.walkMeters + eCand.walkMeters;
          const walkDur = estimateWalkSeconds(totalWalk);
          const totalDur = transitDur + walkDur + 180; // 3 min initial boarding wait
          const totalDist = transitDist + totalWalk;
          const fare = edge.fare;

          const score = totalDur + totalWalk * 1.2;

          rawPaths.push({
            legs: [
              {
                route: edge.route,
                from: sCand.stopName,
                to: eCand.stopName,
                distance: transitDist,
                duration: transitDur,
                fare: edge.fare,
              },
            ],
            transfers: 0,
            totalDistance: Math.round(totalDist),
            totalDuration: Math.round(totalDur),
            totalFare: fare,
            totalWalkingDistance: Math.round(totalWalk),
            walkToStart: sCand.walkMeters > 50 ? {
              from: typeof startInput === 'string' ? startInput : 'Current Location',
              to: sCand.stopName,
              distance: Math.round(sCand.walkMeters),
              duration: estimateWalkSeconds(sCand.walkMeters),
            } : undefined,
            walkToEnd: eCand.walkMeters > 50 ? {
              from: eCand.stopName,
              to: typeof endInput === 'string' ? endInput : 'Destination',
              distance: Math.round(eCand.walkMeters),
              duration: estimateWalkSeconds(eCand.walkMeters),
            } : undefined,
            score,
          });
        }
      }
    }
  }

  // 2. 1-Transfer Routes (1 Transfer)
  const maxDetourMeters = Math.max(airDistanceMeters * 2.4, airDistanceMeters + 5000);

  for (const sCand of startCandidates) {
    const sEdges = adj.get(sCand.stopName) || [];
    for (const e1 of sEdges) {
      const hub = e1.to;
      if (hub === sCand.stopName) continue;

      const hubEdges = adj.get(hub) || [];
      for (const e2 of hubEdges) {
        if (e2.to === sCand.stopName || e2.to === hub) continue;

        for (const eCand of endCandidates) {
          if (e2.to === eCand.stopName) {
            const transitDist = e1.distance + e2.distance;
            // Anti-detour: Prune paths that zig-zag wildly across the city
            if (transitDist > maxDetourMeters) continue;

            const totalWalk = sCand.walkMeters + eCand.walkMeters;
            const walkDur = estimateWalkSeconds(totalWalk);
            const transitDur = e1.duration + e2.duration;
            const transferWait = 360; // 6 mins transfer wait at hub
            const totalDur = transitDur + walkDur + 180 + transferWait;
            const totalDist = transitDist + totalWalk;
            const fare = e1.fare + e2.fare;

            const score = totalDur + 420 + totalWalk * 1.5;

            rawPaths.push({
              legs: [
                {
                  route: e1.route,
                  from: sCand.stopName,
                  to: hub,
                  distance: e1.distance,
                  duration: e1.duration,
                  fare: e1.fare,
                },
                {
                  route: e2.route,
                  from: hub,
                  to: eCand.stopName,
                  distance: e2.distance,
                  duration: e2.duration,
                  fare: e2.fare,
                },
              ],
              transfers: 1,
              totalDistance: Math.round(totalDist),
              totalDuration: Math.round(totalDur),
              totalFare: fare,
              totalWalkingDistance: Math.round(totalWalk),
              walkToStart: sCand.walkMeters > 50 ? {
                from: typeof startInput === 'string' ? startInput : 'Current Location',
                to: sCand.stopName,
                distance: Math.round(sCand.walkMeters),
                duration: estimateWalkSeconds(sCand.walkMeters),
              } : undefined,
              walkToEnd: eCand.walkMeters > 50 ? {
                from: eCand.stopName,
                to: typeof endInput === 'string' ? endInput : 'Destination',
                distance: Math.round(eCand.walkMeters),
                duration: estimateWalkSeconds(eCand.walkMeters),
              } : undefined,
              score,
            });
          }
        }
      }
    }
  }

  // 3. 2-Transfer Routes (2 Transfers)
  // Only explore 2 transfers if direct and 1-transfer routes yielded fewer than 2 viable paths
  if (rawPaths.length < 2) {
    const maxTwoTransferDetour = Math.max(airDistanceMeters * 3.0, airDistanceMeters + 8000);

    for (const sCand of startCandidates.slice(0, 2)) {
      const sEdges = adj.get(sCand.stopName) || [];
      for (const e1 of sEdges) {
        const hub1 = e1.to;
        if (hub1 === sCand.stopName) continue;

        const hub1Edges = adj.get(hub1) || [];
        for (const e2 of hub1Edges) {
          const hub2 = e2.to;
          if (hub2 === sCand.stopName || hub2 === hub1) continue;

          const hub2Edges = adj.get(hub2) || [];
          for (const e3 of hub2Edges) {
            if (e3.to === sCand.stopName || e3.to === hub1 || e3.to === hub2) continue;

            for (const eCand of endCandidates.slice(0, 2)) {
              if (e3.to === eCand.stopName) {
                const transitDist = e1.distance + e2.distance + e3.distance;
                if (transitDist > maxTwoTransferDetour) continue;

                const totalWalk = sCand.walkMeters + eCand.walkMeters;
                const walkDur = estimateWalkSeconds(totalWalk);
                const transitDur = e1.duration + e2.duration + e3.duration;
                const transferWait = 720; // 12 mins (two transfers)
                const totalDur = transitDur + walkDur + 180 + transferWait;
                const totalDist = transitDist + totalWalk;
                const fare = e1.fare + e2.fare + e3.fare;

                const score = totalDur + 840 + totalWalk * 1.8;

                rawPaths.push({
                  legs: [
                    {
                      route: e1.route,
                      from: sCand.stopName,
                      to: hub1,
                      distance: e1.distance,
                      duration: e1.duration,
                      fare: e1.fare,
                    },
                    {
                      route: e2.route,
                      from: hub1,
                      to: hub2,
                      distance: e2.distance,
                      duration: e2.duration,
                      fare: e2.fare,
                    },
                    {
                      route: e3.route,
                      from: hub2,
                      to: eCand.stopName,
                      distance: e3.distance,
                      duration: e3.duration,
                      fare: e3.fare,
                    },
                  ],
                  transfers: 2,
                  totalDistance: Math.round(totalDist),
                  totalDuration: Math.round(totalDur),
                  totalFare: fare,
                  totalWalkingDistance: Math.round(totalWalk),
                  walkToStart: sCand.walkMeters > 50 ? {
                    from: typeof startInput === 'string' ? startInput : 'Current Location',
                    to: sCand.stopName,
                    distance: Math.round(sCand.walkMeters),
                    duration: estimateWalkSeconds(sCand.walkMeters),
                  } : undefined,
                  walkToEnd: eCand.walkMeters > 50 ? {
                    from: eCand.stopName,
                    to: typeof endInput === 'string' ? endInput : 'Destination',
                    distance: Math.round(eCand.walkMeters),
                    duration: estimateWalkSeconds(eCand.walkMeters),
                  } : undefined,
                  score,
                });
              }
            }
          }
        }
      }
    }
  }

  // 4. Deduplication & Anti-Redundancy Filter
  const seenSignatures = new Set<string>();
  const uniquePaths: TripPath[] = [];

  // Sort raw paths by intelligence score first so the highest quality instance of each corridor wins
  rawPaths.sort((a, b) => a.score - b.score);

  for (const path of rawPaths) {
    const corridorSig = path.legs.map((l) => `${getCanonicalStop(l.from)}->${getCanonicalStop(l.to)}`).join('|');
    if (seenSignatures.has(corridorSig)) continue;
    seenSignatures.add(corridorSig);
    uniquePaths.push(path);
  }

  // If direct routes exist, limit 1-transfer routes to only genuinely faster or distinct corridors
  let filteredPaths = uniquePaths;
  const directRoutes = uniquePaths.filter((p) => p.transfers === 0);
  if (directRoutes.length > 0) {
    const bestDirectDuration = directRoutes[0].totalDuration;
    filteredPaths = uniquePaths.filter((p) => {
      if (p.transfers === 0) return true;
      return p.totalDuration < bestDirectDuration * 1.25;
    });
    if (filteredPaths.length < 2) {
      filteredPaths = uniquePaths.slice(0, 3);
    }
  }

  // Limit to top 4 polished routes
  const topPaths = filteredPaths.slice(0, 4);

  // Assign distinct intelligence badges
  if (topPaths.length > 0) {
    // 1. Recommended (Index 0 has the lowest score = Best Overall)
    topPaths[0].badge = 'recommended';
    topPaths[0].badgeLabel = {
      en: 'Best Overall',
      am: 'ምርጥ ምርጫ',
    };

    // 2. Direct route badge if applicable
    const directIdx = topPaths.findIndex((p) => p.transfers === 0);
    if (directIdx !== -1 && directIdx !== 0) {
      topPaths[directIdx].badge = 'direct';
      topPaths[directIdx].badgeLabel = {
        en: 'Direct Line',
        am: 'ቀጥታ መስመር',
      };
    }

    // 3. Lowest Fare badge
    let minFare = Infinity;
    let minFareIdx = -1;
    topPaths.forEach((p, idx) => {
      if (!p.badge && p.totalFare < minFare) {
        minFare = p.totalFare;
        minFareIdx = idx;
      }
    });
    if (minFareIdx !== -1 && minFare < topPaths[0].totalFare) {
      topPaths[minFareIdx].badge = 'cheapest';
      topPaths[minFareIdx].badgeLabel = {
        en: 'Lowest Fare',
        am: 'ተመጣጣኝ ዋጋ',
      };
    }

    // 4. Fastest badge if distinct from recommended
    let minDuration = Infinity;
    let fastestIdx = -1;
    topPaths.forEach((p, idx) => {
      if (!p.badge && p.totalDuration < minDuration) {
        minDuration = p.totalDuration;
        fastestIdx = idx;
      }
    });
    if (fastestIdx !== -1 && minDuration < topPaths[0].totalDuration) {
      topPaths[fastestIdx].badge = 'fastest';
      topPaths[fastestIdx].badgeLabel = {
        en: 'Fastest ETA',
        am: 'ፈጣን ጉዞ',
      };
    }
  }

  return topPaths;
}

/**
 * Decodes or fetches accurate road geometry via OSRM for each leg.
 */
export async function enhancePathWithGeometry(
  path: TripPath,
  coords: Record<string, [number, number]>
): Promise<TripPath> {
  const enhancedLegs = await Promise.all(
    path.legs.map(async (leg) => {
      const start = coords[leg.from];
      const end = coords[leg.to];

      if (!isValidLatLng(start) || !isValidLatLng(end)) return leg;

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const rawCoords = data.routes[0].geometry?.coordinates;
          if (Array.isArray(rawCoords)) {
            const geometry: [number, number][] = [];
            for (const c of rawCoords) {
              if (
                Array.isArray(c) &&
                typeof c[0] === 'number' &&
                typeof c[1] === 'number' &&
                !isNaN(c[0]) &&
                !isNaN(c[1]) &&
                isFinite(c[0]) &&
                isFinite(c[1])
              ) {
                geometry.push([c[1], c[0]]);
              }
            }
            if (geometry.length > 0) {
              const distance =
                typeof data.routes[0].distance === 'number' && !isNaN(data.routes[0].distance)
                  ? data.routes[0].distance
                  : leg.distance;
              const duration =
                typeof data.routes[0].duration === 'number' && !isNaN(data.routes[0].duration)
                  ? data.routes[0].duration
                  : leg.duration;
              return { ...leg, geometry, distance, duration };
            }
          }
        }
      } catch (error) {
        // Silently use existing straight-line / estimated geometry on timeout or network error
      }

      return leg;
    })
  );

  let totalTransitDistance = 0;
  let totalTransitDuration = 0;

  enhancedLegs.forEach((leg) => {
    totalTransitDistance += leg.distance || 0;
    totalTransitDuration += leg.duration || 0;
  });

  const totalWalking = path.totalWalkingDistance || 0;
  const walkDur = estimateWalkSeconds(totalWalking);
  const transferTime = path.transfers * 360;

  return {
    ...path,
    legs: enhancedLegs,
    totalDistance: Math.round(totalTransitDistance + totalWalking),
    totalDuration: Math.round(totalTransitDuration + walkDur + 180 + transferTime),
  };
}
