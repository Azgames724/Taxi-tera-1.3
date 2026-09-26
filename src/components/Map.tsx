/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, Fragment, memo, useRef, useState, useCallback, MutableRefObject } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Station, COORDS, STATIONS, ROUTES } from '../data/transitData';
import { TripPath } from '../lib/routing';
import { isValidLatLng, DEFAULT_ADDIS_CENTER, DEFAULT_ZOOM } from '../utils/geoUtils';

// Fix Leaflet marker icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface StationReport {
  id: string;
  stationName: string;
  type: 'busy' | 'info' | 'minibus';
  status: 'critical' | 'moderate' | 'free' | 'info' | 'pinned';
  userName: string;
  userAvatar: string;
  userBg: string;
  text: string;
  timestamp: number;
  location: [number, number];
}

interface MapProps {
  center: [number, number];
  zoom: number;
  userLocation: [number, number] | null;
  selectedStation: Station | null;
  activePath: TripPath | null;
  onStationClick: (s: Station | string) => void;
  lang: 'en' | 'am';
  panelOpen: boolean;
  isOffline?: boolean;
  plannerStart?: [number, number] | null;
  plannerEnd?: [number, number] | null;
  reports?: StationReport[];
  onReportClick?: (report: StationReport) => void;
  isLowDataMode?: boolean;
  onOpenOfflineManager?: () => void;
}

function MapUpdater({ center, zoom, activePath, panelOpen, plannerStart, plannerEnd }: { center: [number, number], zoom: number, activePath: any, panelOpen: boolean, plannerStart?: [number, number] | null; plannerEnd?: [number, number] | null }) {
  const map = useMap();
  const safeInitCenter: [number, number] = isValidLatLng(center) ? center : DEFAULT_ADDIS_CENTER;
  const safeInitZoom: number = (typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom)) ? zoom : DEFAULT_ZOOM;
  const lastCenter = useRef<[number, number]>(safeInitCenter);
  const lastZoom = useRef<number>(safeInitZoom);
  const isMoving = useRef(false);

  const lastActivePathSig = useRef<string | null>(null);
  const lastPlannerStartSig = useRef<string | null>(null);
  const lastPlannerEndSig = useRef<string | null>(null);
  
  useEffect(() => {
    map.on('movestart', () => { isMoving.current = true; });
    map.on('moveend', () => { isMoving.current = false; });
  }, [map]);

  useEffect(() => {
    // Immediate and staggered invalidateSize to ensure tiles render immediately on mount & panel shifts
    try {
      map.invalidateSize({ animate: false });
    } catch {
      // ignore
    }
    const t1 = setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 100);
    const t2 = setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 350);
    const t3 = setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 800);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        try {
          map.invalidateSize({ animate: false });
        } catch {}
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver && container) {
        resizeObserver.unobserve(container);
        resizeObserver.disconnect();
      }
    };
  }, [map, panelOpen]);

  useEffect(() => {
    if (!isValidLatLng(center)) {
      return;
    }
    const targetZoom = (typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom)) ? zoom : DEFAULT_ZOOM;

    const hasCenterChanged = lastCenter.current[0] !== center[0] || lastCenter.current[1] !== center[1];
    const hasZoomChanged = lastZoom.current !== targetZoom;

    if (hasCenterChanged || hasZoomChanged) {
      try {
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();

        const latDiff = Math.abs(currentCenter.lat - center[0]);
        const lngDiff = Math.abs(currentCenter.lng - center[1]);
        
        // Ignore micro-jitter to save CPU and reduce lag
        if (latDiff < 0.0001 && lngDiff < 0.0001 && Math.abs(currentZoom - targetZoom) < 0.05) return;

        const isBigJump = latDiff > 0.02 || lngDiff > 0.02;

        if (isBigJump || hasZoomChanged) {
          map.flyTo(center, targetZoom, { duration: 0.7, easeLinearity: 0.25 });
        } else {
          map.panTo(center, { animate: true, duration: 0.35 });
        }
        
        lastCenter.current = center;
        lastZoom.current = targetZoom;
      } catch (err) {
        console.warn('Map animation error ignored:', err);
      }
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const pathSig = activePath ? activePath.legs?.map((l: any) => `${l.from}-${l.to}`).join('|') : 'null';
    const startSig = isValidLatLng(plannerStart) ? `${plannerStart[0].toFixed(5)},${plannerStart[1].toFixed(5)}` : 'null';
    const endSig = isValidLatLng(plannerEnd) ? `${plannerEnd[0].toFixed(5)},${plannerEnd[1].toFixed(5)}` : 'null';

    const hasPathChanged = lastActivePathSig.current !== pathSig;
    const hasStartChanged = lastPlannerStartSig.current !== startSig;
    const hasEndChanged = lastPlannerEndSig.current !== endSig;

    if (!hasPathChanged && !hasStartChanged && !hasEndChanged) {
      return;
    }

    lastActivePathSig.current = pathSig;
    lastPlannerStartSig.current = startSig;
    lastPlannerEndSig.current = endSig;

    if (activePath && Array.isArray(activePath.legs) && activePath.legs.length > 0) {
      const coords: [number, number][] = [];
      activePath.legs.forEach((leg: any) => {
        if (Array.isArray(leg.geometry)) {
          leg.geometry.forEach((pt: any) => {
            if (isValidLatLng(pt)) coords.push(pt);
          });
        } else {
          const fromPt = COORDS[leg.from];
          const toPt = COORDS[leg.to];
          if (isValidLatLng(fromPt)) coords.push(fromPt);
          if (isValidLatLng(toPt)) coords.push(toPt);
        }
      });
      
      if (coords.length > 1) {
        try {
          const bounds = L.latLngBounds(coords);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 0.6 });
          }
        } catch (err) {
          console.warn('Map fitBounds route error ignored:', err);
        }
      }
    } else {
      const coords: [number, number][] = [];
      if (isValidLatLng(plannerStart)) coords.push(plannerStart);
      if (isValidLatLng(plannerEnd)) coords.push(plannerEnd);
      if (coords.length > 0) {
        if (coords.length === 1) {
          try {
            map.setView(coords[0], 15, { animate: true });
          } catch (err) {
            console.warn('Map setView error ignored:', err);
          }
        } else {
          try {
            const bounds = L.latLngBounds(coords);
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true, duration: 0.6 });
            }
          } catch (err) {
            console.warn('Map fitBounds planner error ignored:', err);
          }
        }
      }
    }
  }, [activePath, plannerStart, plannerEnd, map]);

  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom())
  });
  return null;
}

const createUserIcon = (heading: number) => L.divIcon({
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 160px; height: 160px;">
      <!-- Directional beam SVG light cone with soft gradient and blur -->
      <svg style="position: absolute; width: 160px; height: 160px; transform: rotate(${heading}deg); pointer-events: none; z-index: 5;" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="beamGradient-${Math.floor(heading)}" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.75"/>
            <stop offset="25%" stop-color="#06b6d4" stop-opacity="0.45"/>
            <stop offset="60%" stop-color="#0891B2" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#0891B2" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M 80 80 L 40 10.72 A 80 80 0 0 1 120 10.72 Z" fill="url(#beamGradient-${Math.floor(heading)})" filter="blur(1px)" />
      </svg>
      
      <!-- Pulsating general accuracy aura/radar halo -->
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(8, 145, 178, 0.15); border: 1.5px solid rgba(8, 145, 178, 0.35); animation: pulse 2.2s infinite ease-in-out; z-index: 6;"></div>
      
      <!-- Sparkling premium white/cyan core GPS dot -->
      <div style="position: absolute; width: 16px; height: 16px; border-radius: 50%; background: #06b6d4; border: 2.5px solid white; box-shadow: 0 0 12px rgba(6, 182, 212, 0.9), 0 2px 8px rgba(0,0,0,0.3); z-index: 10;"></div>
      
      <!-- Small directional tip directly mounted to indicate precise vector -->
      <div style="
        position: absolute;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 6px solid #0891B2;
        transform-origin: 50% 12px;
        transform: translate(0, -12px) rotate(${heading}deg);
        z-index: 11;
      "></div>
    </div>
  `,
  className: '',
  iconSize: [160, 160],
  iconAnchor: [80, 80]
});

const minibusIconCache: Record<string, L.DivIcon> = {};
const minibusIcon = (showIcon?: boolean, count?: number) => {
  const cacheKey = `${showIcon}_${count || 3}`;
  if (minibusIconCache[cacheKey]) return minibusIconCache[cacheKey];

  const icon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px;">
        <!-- iOS style custom translucent coverage range halo matching screenshot exactly -->
        <div style="position: absolute; width: 52px; height: 52px; border-radius: 50%; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25);"></div>
        <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(56, 189, 248, 0.1); filter: blur(3px);"></div>
        
        <!-- Sleek high-contrast black marker node -->
        <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #0f172a; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.2); transition: transform 0.2s ease;">
          <span style="font-size: ${showIcon ? '11px' : '9px'}; font-weight: 900; color: white; font-family: system-ui, -apple-system, sans-serif;">
            ${showIcon ? '🚌' : (count || 3)}
          </span>
        </div>
      </div>
    `,
    className: '',
    iconSize: [64, 64],
    iconAnchor: [32, 32]
  });
  minibusIconCache[cacheKey] = icon;
  return icon;
};

const routeIconCache: Record<string, L.DivIcon> = {};
const routeIcon = (isStart?: boolean) => {
  const cacheKey = `${isStart}`;
  if (routeIconCache[cacheKey]) return routeIconCache[cacheKey];

  const icon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
        <!-- High contrast travel nodes with subtle micro bounce -->
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); filter: blur(2px);"></div>
        <div style="background: ${isStart ? '#0891B2' : '#F59E0B'}; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); animation: bounce 1.2s infinite alternate;">
          <span style="font-size: 11px;">${isStart ? '🏁' : '📍'}</span>
        </div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
  routeIconCache[cacheKey] = icon;
  return icon;
};

const plannerStartIconCache: Record<string, L.DivIcon> = {};
const plannerStartIcon = (label: string) => {
  if (plannerStartIconCache[label]) return plannerStartIconCache[label];

  const icon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 120px; height: 60px;">
        <div style="background: #0891B2; color: white; font-family: system-ui, -apple-system, sans-serif; font-size: 9px; font-weight: 900; padding: 4px 10px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(8,145,178,0.3); border: 2.5px solid white; white-space: nowrap; margin-bottom: 2px;">
           🏁 ${label}
        </div>
        <div style="background: #0891B2; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
      </div>
    `,
    className: '',
    iconSize: [120, 60],
    iconAnchor: [60, 52]
  });
  plannerStartIconCache[label] = icon;
  return icon;
};

const plannerEndIconCache: Record<string, L.DivIcon> = {};
const plannerEndIcon = (label: string) => {
  if (plannerEndIconCache[label]) return plannerEndIconCache[label];

  const icon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 120px; height: 60px;">
        <div style="background: #F59E0B; color: white; font-family: system-ui, -apple-system, sans-serif; font-size: 9px; font-weight: 900; padding: 4px 10px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(245,158,11,0.3); border: 2.5px solid white; white-space: nowrap; margin-bottom: 2px;">
           📍 ${label}
        </div>
        <div style="background: #F59E0B; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.355);"></div>
      </div>
    `,
    className: '',
    iconSize: [120, 60],
    iconAnchor: [60, 52]
  });
  plannerEndIconCache[label] = icon;
  return icon;
};

const pinnedReportIconCache: Record<string, L.DivIcon> = {};
const pinnedReportIcon = (type: 'busy' | 'info' | 'minibus', status: string, label: string) => {
  const cacheKey = `${type}_${status}_${label}`;
  if (pinnedReportIconCache[cacheKey]) return pinnedReportIconCache[cacheKey];

  const icon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 80px; height: 80px;">
        <!-- Pulsing indicator halo -->
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${type === 'busy' ? 'rgba(239, 68, 68, 0.2)' : type === 'minibus' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; border: 1.5px solid ${type === 'busy' ? '#ef4444' : type === 'minibus' ? '#06b6d4' : '#f59e0b'}; animation: pulse 2s infinite ease-in-out;"></div>
        
        <!-- Icon badge container -->
        <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: ${type === 'busy' ? '#ef4444' : type === 'minibus' ? '#06b6d4' : '#f59e0b'}; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 10;">
          <span style="font-size: 13px; color: white;">
            ${type === 'busy' ? '🔥' : type === 'minibus' ? '🚌' : 'ℹ️'}
          </span>
        </div>
        
        <!-- Label tooltip hovering above the pin -->
        <div style="position: absolute; bottom: 58px; background: #0f172a; border: 1.5px solid rgba(255,255,255,0.15); color: white; font-family: system-ui, -apple-system, sans-serif; font-size: 8px; font-weight: 900; padding: 2.5px 7px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 12;">
          ${label}
        </div>
      </div>
    `,
    className: '',
    iconSize: [80, 80],
    iconAnchor: [40, 40]
  });
  pinnedReportIconCache[cacheKey] = icon;
  return icon;
};

const mapStyles = `
  @keyframes bounce {
    from { transform: translateY(0); }
    to { transform: translateY(-4px); }
  }
  @keyframes pulse {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0.5; }
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
    background-color: rgba(15, 23, 42, 0.15) !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
    background-color: #0f172a !important;
    color: white !important;
    font-weight: 900 !important;
    font-size: 11px !important;
    width: 28px !important;
    height: 28px !important;
    border-radius: 50% !important;
    border: 2px solid white !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 4px !important;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
  }
`;

interface StationMarkerProps {
  name: string;
  pos: [number, number];
  icon: L.DivIcon;
  onClick: (name: string, pos: [number, number]) => void;
}

const StationMarker = memo(({ name, pos, icon, onClick }: StationMarkerProps) => {
  const clickHandler = useCallback(() => {
    onClick(name, pos);
  }, [name, pos, onClick]);

  const eventHandlers = useMemo(() => ({
    click: clickHandler
  }), [clickHandler]);

  if (!isValidLatLng(pos)) {
    return null;
  }

  return (
    <Marker 
      position={pos} 
      icon={icon}
      eventHandlers={eventHandlers}
    />
  );
});

interface ReportMarkerProps {
  report: StationReport;
  icon: L.DivIcon;
  onClick?: (report: StationReport) => void;
}

const ReportMarker = memo(({ report, icon, onClick }: ReportMarkerProps) => {
  const clickHandler = useCallback(() => {
    if (onClick) {
      onClick(report);
    }
  }, [report, onClick]);

  const eventHandlers = useMemo(() => ({
    click: clickHandler
  }), [clickHandler]);

  if (!isValidLatLng(report.location)) {
    return null;
  }

  return (
    <Marker 
      position={report.location} 
      icon={icon}
      eventHandlers={eventHandlers}
      zIndexOffset={6000}
    />
  );
});


const getSanitizedCartoKey = (): string => {
  const key = (import.meta.env.VITE_CARTO_API_KEY as string) || '';
  if (key && !key.includes('YOUR_KEY') && !key.includes('http') && key.trim().length > 5) {
    return key.trim();
  }
  return 'cb1_3tnb_1_2da65b7a79e52dc561858c69';
};

const CARTO_KEY = getSanitizedCartoKey();

const Map = memo(({ center, zoom, userLocation, activePath, onStationClick, lang, panelOpen, isOffline = false, plannerStart, plannerEnd, reports, onReportClick, isLowDataMode = false, onOpenOfflineManager }: MapProps) => {
  const [heading, setHeading] = useState(0);
  const hasSensor = useRef(false);
  const lastInteractionTime = useRef(0);

  useEffect(() => {
    let smoothDx = 0;
    let smoothDy = 0;
    let first = true;
    let lastHeading = 0;
    let lastTime = 0;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let currentHeading = 0;
      let detected = false;

      // 1. WebKit Compass heading (iOS Safari)
      if ('webkitCompassHeading' in e) {
        const h = e.webkitCompassHeading as number;
        if (h !== undefined && h !== null && !isNaN(h)) {
          currentHeading = h;
          detected = true;
        }
      } 
      // 2. Standard absolute orientation (Android Chrome / generic)
      else if (e.alpha !== null && e.alpha !== undefined && !isNaN(e.alpha)) {
        currentHeading = (360 - e.alpha) % 360;
        detected = true;
      }

      if (detected) {
        hasSensor.current = true;
        
        // Convert to radians to compute unit vector
        const rad = (currentHeading * Math.PI) / 180;
        const dx = Math.sin(rad);     // 0 heading -> dx = 0, pointing up (North)
        const dy = -Math.cos(rad);    // 0 heading -> dy = -1, pointing up (North)

        if (first) {
          smoothDx = dx;
          smoothDy = dy;
          first = false;
        } else {
          // Exponential moving average filter for buttery smooth yet highly responsive directional tracking
          const smoothingFactor = 0.15; 
          smoothDx = smoothDx + smoothingFactor * (dx - smoothDx);
          smoothDy = smoothDy + smoothingFactor * (dy - smoothDy);
        }

        // Convert smoothed unit vector back to degrees
        let smoothAngleRad = Math.atan2(smoothDx, -smoothDy);
        let smoothAngleDeg = (smoothAngleRad * 180) / Math.PI;
        if (smoothAngleDeg < 0) {
          smoothAngleDeg += 360;
        }

        const now = Date.now();
        const diffAngle = Math.abs(smoothAngleDeg - lastHeading);
        const shortestDiff = Math.min(diffAngle, 360 - diffAngle);
        if (now - lastTime > 150 && shortestDiff > 3) {
          setHeading(smoothAngleDeg);
          lastHeading = smoothAngleDeg;
          lastTime = now;
        }
      }
    };

    if ('ondeviceorientationabsolute' in (window as any)) {
      (window as any).addEventListener('deviceorientationabsolute', handleOrientation);
    } else {
      (window as any).addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if ('ondeviceorientationabsolute' in (window as any)) {
        (window as any).removeEventListener('deviceorientationabsolute', handleOrientation);
      } else {
        (window as any).removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  const locations = useMemo(() => Object.entries(COORDS), []);
  const stationData = useMemo(() => STATIONS, []);
  
  const stationLookup = useMemo(() => {
    const map = new globalThis.Map<string, Station>();
    for (const s of STATIONS) {
      map.set(s.name, s);
    }
    return map;
  }, []);

  const [currentZoom, setCurrentZoom] = useState(zoom);

  const [localOffline, setLocalOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setLocalOffline(false);
    const handleOffline = () => setLocalOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const offline = isOffline || localOffline;

  const handleMarkerClick = useMemo(() => (name: string, pos: [number, number]) => {
    onStationClick(name);
  }, [onStationClick]);

  const handleTileError = useCallback((error: L.TileErrorEvent) => {
    const tile = error.tile as HTMLImageElement;
    if (!tile) return;
    const retryCount = Number(tile.dataset.retried || 0);
    const coords = (error as any).coords;
    if (!coords) return;

    if (retryCount === 0) {
      tile.dataset.retried = '1';
      // Subdomain mirror fallback
      tile.src = CARTO_KEY
        ? `https://a.basemaps.cartocdn.com/light_all/${coords.z}/${coords.x}/${coords.y}.png?key=${CARTO_KEY}`
        : `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
    } else if (retryCount === 1) {
      tile.dataset.retried = '2';
      // OpenStreetMap global tile server fallback
      tile.src = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
    }
  }, []);

  const showStationIcons = currentZoom >= 16;

  const safeCenter: [number, number] = useMemo(() => {
    return isValidLatLng(center) ? center : DEFAULT_ADDIS_CENTER;
  }, [center]);

  const safeZoom: number = useMemo(() => {
    return (typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom)) ? zoom : DEFAULT_ZOOM;
  }, [zoom]);

  return (
    <div className="w-full h-full relative z-0">
      <style>{mapStyles}</style>

      {/* Map */}
      <MapContainer 
        center={safeCenter} 
        zoom={safeZoom} 
        scrollWheelZoom={true} 
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', minHeight: '100%' }}
        maxBounds={[[8.40, 38.30], [9.60, 39.20]]}
        maxBoundsViscosity={0.25}
        minZoom={10}
        maxZoom={18}
      >
        <TileLayer
          attribution={CARTO_KEY
            ? '&copy; <a href="https://carto.com/" target="_blank" rel="noopener noreferrer">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}
          url={CARTO_KEY
            ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
            : `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`}
          subdomains={CARTO_KEY ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c']}
          eventHandlers={{
            tileerror: handleTileError,
          }}
          updateWhenIdle={false}
          keepBuffer={6}
          opacity={1.0}
          maxZoom={19}
        />
        <MapUpdater center={safeCenter} zoom={safeZoom} activePath={activePath} panelOpen={panelOpen} plannerStart={plannerStart} plannerEnd={plannerEnd} />
        <ZoomTracker onZoomChange={setCurrentZoom} />
        
        {isValidLatLng(userLocation) && (
          <Marker position={userLocation} icon={createUserIcon(heading)} zIndexOffset={3000} />
        )}

        {isValidLatLng(plannerStart) && (
          <Marker 
            position={plannerStart} 
            icon={plannerStartIcon(lang === 'en' ? 'Origin' : 'መነሻ')} 
            zIndexOffset={5000}
          />
        )}

        {isValidLatLng(plannerEnd) && (
          <Marker 
            position={plannerEnd} 
            icon={plannerEndIcon(lang === 'en' ? 'Destination' : 'መድረሻ')} 
            zIndexOffset={5000}
          />
        )}

        <MarkerClusterGroup
          maxClusterRadius={60}
          disableClusteringAtZoom={15}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
        >
          {locations.map(([name, pos], index) => {
            if (!isValidLatLng(pos)) return null;
            const station = stationLookup.get(name);
            return (
              <StationMarker 
                key={`loc-${name}-${showStationIcons ? 'icon' : 'num'}`}
                name={name}
                pos={pos} 
                icon={minibusIcon(showStationIcons, station?.r.length || (index % 5 + 2))}
                onClick={onStationClick}
              />
            );
          })}
        </MarkerClusterGroup>

        {/* Route visualization for the active path */}
        {activePath ? (
          <Fragment key={`active-path-${activePath.legs?.length || 0}-${activePath.legs?.map(l => l.from).join('-')}-${activePath.legs?.some(l => !!l.geometry)}`}>
            {activePath.legs?.map((leg, i) => {
              const fromCoord = COORDS[leg.from];
              const toCoord = COORDS[leg.to];
              
              if (!isValidLatLng(fromCoord) || !isValidLatLng(toCoord)) return null;

              // If geometry exists, validate each point. Otherwise use the start/end points.
              const validGeometry = Array.isArray(leg.geometry) ? leg.geometry.filter(isValidLatLng) : null;
              const positions: [number, number][] = (validGeometry && validGeometry.length > 1) ? validGeometry : [fromCoord, toCoord];

              return (
                <Fragment key={`leg-${i}-${leg.from}-${leg.to}`}>
                  <Marker 
                    position={fromCoord} 
                    icon={routeIcon(i === 0)} 
                    zIndexOffset={4000 + i}
                  />
                  {i === activePath.legs.length - 1 && (
                    <Marker 
                      position={toCoord} 
                      icon={routeIcon(false)} 
                      zIndexOffset={4000 + i + 1}
                    />
                  )}
                  {/* Glow effect for road path */}
                  <Polyline 
                    positions={positions} 
                    pathOptions={{ 
                      color: 'white', 
                      weight: 10,
                      opacity: 0.6,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }} 
                  />
                  <Polyline 
                    positions={positions} 
                    pathOptions={{ 
                      color: i % 2 === 0 ? '#0891B2' : '#F59E0B', 
                      weight: 5,
                      lineCap: 'round',
                      lineJoin: 'round',
                      opacity: 1,
                      dashArray: leg.geometry ? undefined : '10, 10'
                    }} 
                  />
                  {/* Invisible wide polyline for easier clicks */}
                  <Polyline 
                    positions={positions} 
                    pathOptions={{ 
                      color: 'transparent',
                      weight: 20
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        handleMarkerClick(leg.from, fromCoord);
                      }
                    }}
                  />
                </Fragment>
              );
            })}
          </Fragment>
        ) : null}

        {/* Community crowdsourced pins & updates */}
        {reports?.filter(r => r && isValidLatLng(r.location)).map((report) => (
          <ReportMarker 
            key={`report-marker-${report.id}`}
            report={report}
            icon={pinnedReportIcon(
              report.type, 
              report.status, 
              report.type === 'busy' 
                ? (lang === 'en' ? 'BUSY! 🔥' : 'ከፍተኛ ሰልፍ 🔥') 
                : report.type === 'minibus' 
                  ? (lang === 'en' ? 'TAXI! 🚌' : 'ታክሲ 🚌') 
                  : (lang === 'en' ? 'INFO ℹ️' : 'መረጃ ℹ️')
            )}
            onClick={onReportClick}
          />
        ))}
      </MapContainer>
    </div>
  );
});

export default Map;

