/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  CheckCircle2, 
  Trash2, 
  X, 
  RefreshCw, 
  AlertCircle,
  Zap,
  Gauge,
  Layers,
  MapPin
} from 'lucide-react';
import { 
  downloadAddisOfflineMap, 
  getOfflineMapStatus, 
  clearOfflineMapCache, 
  getNetworkQuality,
  OfflineMapMeta,
  DownloadProgress 
} from '../utils/offlineMapManager';

interface OfflineMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'am';
  isOffline: boolean;
  onToggleOffline: () => void;
  isLowDataMode: boolean;
  onToggleLowDataMode: () => void;
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  isOpen,
  onClose,
  lang,
  isOffline,
  onToggleOffline,
  isLowDataMode,
  onToggleLowDataMode
}) => {
  const [meta, setMeta] = useState<OfflineMapMeta>({
    isDownloaded: false,
    tileCount: 0,
    estimatedSizeMb: 0,
    downloadedAt: null,
    packType: null
  });

  const [selectedPack, setSelectedPack] = useState<'core' | 'detailed'>('core');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Network metrics
  const [networkInfo, setNetworkInfo] = useState(getNetworkQuality());

  useEffect(() => {
    if (!isOpen) return;

    // Refresh cache inspection
    getOfflineMapStatus().then(setMeta);
    setNetworkInfo(getNetworkQuality());

    const updateNetwork = () => setNetworkInfo(getNetworkQuality());
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, [isOpen]);

  const handleStartDownload = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDownloadProgress({
      total: selectedPack === 'detailed' ? 850 : 305,
      completed: 0,
      failed: 0,
      percent: 0,
      currentZoom: 12,
      estimatedBytes: 0,
      status: 'downloading'
    });

    const success = await downloadAddisOfflineMap(
      selectedPack,
      (p) => setDownloadProgress(p),
      controller.signal
    );

    if (success) {
      const updatedMeta = await getOfflineMapStatus();
      setMeta(updatedMeta);
      setTimeout(() => setDownloadProgress(null), 1800);
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDownloadProgress(null);
  };

  const handleDeleteCache = async () => {
    if (window.confirm(lang === 'en' ? 'Remove downloaded offline map tiles?' : 'የወረደውን የኦፍላይን ካርታ ማጥፋት ይፈልጋሉ?')) {
      setIsClearing(true);
      await clearOfflineMapCache();
      const updatedMeta = await getOfflineMapStatus();
      setMeta(updatedMeta);
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] z-10 font-sans"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-b from-slate-50/70 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-100/60 flex items-center justify-center text-cyan-600 shadow-sm">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                  {lang === 'en' ? 'Offline Map & Data Saver' : 'ኦፍላይን ካርታ እና ዳታ ቁጣቢ'}
                </h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  {lang === 'en' ? 'Addis Ababa transit without internet' : 'ያለ ኢንተርኔት የአዲስ አበባ የትራንስፖርት መመሪያ'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 touch-pan-y">
            
            {/* Live Connection / Network Health Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-cyan-600" />
                  {lang === 'en' ? 'Connection Status' : 'የግንኙነት ሁኔታ'}
                </span>

                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    isOffline 
                      ? 'bg-rose-500' 
                      : networkInfo.isLowSpeed 
                      ? 'bg-amber-500 animate-pulse' 
                      : 'bg-emerald-500'
                  }`} />
                  <span className="text-[11px] font-black uppercase text-slate-700">
                    {isOffline 
                      ? (lang === 'en' ? 'Offline' : 'ኦፍላይን') 
                      : networkInfo.isLowSpeed 
                      ? (lang === 'en' ? 'Low Internet (2G/3G)' : 'ደካማ ኢንተርኔት (2G/3G)') 
                      : (lang === 'en' ? 'Connected (Fast)' : 'ፈጣን ግንኙነት')}
                  </span>
                </div>
              </div>

              {/* Data Saver Mode Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                <div className="pr-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    {lang === 'en' ? 'Low Internet / Data Saver' : 'ዳታ ቆጣቢ ሁነታ'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {lang === 'en' 
                      ? 'Caches tiles, stops heavy polling & saves 95% cellular data' 
                      : 'የሞባይል ዳታ ፍጆታን 95% ይቀንሳል፤ ካርታዎችን ከስልክ ያነባል'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleLowDataMode}
                  className={`w-12 h-6.5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                    isLowDataMode ? 'bg-cyan-600' : 'bg-slate-300'
                  }`}
                >
                  <motion.div
                    animate={{ x: isLowDataMode ? 22 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="bg-white w-4.5 h-4.5 rounded-full shadow-md"
                  />
                </button>
              </div>

              {/* Force Offline Mode Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                <div className="pr-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {isOffline ? <WifiOff className="w-3.5 h-3.5 text-rose-500" /> : <Wifi className="w-3.5 h-3.5 text-slate-400" />}
                    {lang === 'en' ? 'Simulate 100% Offline' : 'ኦፍላይን ሁነታን አስገድድ'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {lang === 'en' 
                      ? 'Test app without turning off phone Wi-Fi or data' 
                      : 'ያለ ሞባይል ዳታ አፑን በተሟላ መልኩ ለመጠቀም'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleOffline}
                  className={`w-12 h-6.5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                    isOffline ? 'bg-rose-600' : 'bg-slate-300'
                  }`}
                >
                  <motion.div
                    animate={{ x: isOffline ? 22 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="bg-white w-4.5 h-4.5 rounded-full shadow-md"
                  />
                </button>
              </div>
            </div>

            {/* Offline Map Package Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900">
                      {lang === 'en' ? 'Addis Ababa Offline Map' : 'የአዲስ አበባ ኦፍላይን ካርታ'}
                    </h4>
                    {meta.isDownloaded && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[9px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        {lang === 'en' ? 'Ready Offline' : 'ዝግጁ ነው'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {lang === 'en' 
                      ? 'Download vector-styled map tiles covering all Addis Ababa subcities, Ring Roads, and terminals for zero-internet navigation.'
                      : 'ሁሉንም የአዲስ አበባ ክፍለ ከተሞች፣ ዋና መንገዶችና ተራዎችን ያለ ኢንተርኔት በካርታው ላይ ለመመልከት ካርታውን አውርደው ያስቀምጡ።'}
                  </p>
                </div>
              </div>

              {/* Pack Selector if not yet downloading */}
              {!downloadProgress && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPack('core')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedPack === 'core'
                        ? 'border-cyan-600 bg-cyan-50/40 ring-1 ring-cyan-600'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700">
                        {lang === 'en' ? 'Core City Pack' : 'መደበኛ ጥቅል'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">~4.5 MB</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {lang === 'en' ? 'Metro & Corridors' : 'ከተማና ዋና መንገዶች'}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {lang === 'en' ? 'Zoom 12-14 • Fast 4s load' : 'ደረጃ 12-14 • ፈጣን'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPack('detailed')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedPack === 'detailed'
                        ? 'border-cyan-600 bg-cyan-50/40 ring-1 ring-cyan-600'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {lang === 'en' ? 'Full Detail Pack' : 'ዝርዝር ጥቅል'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">~12 MB</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {lang === 'en' ? 'Deep Neighborhoods' : 'የሰፈር መንገዶች ጭምር'}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {lang === 'en' ? 'Zoom 12-15 • Deep zoom' : 'ደረጃ 12-15 • የተሟላ'}
                    </div>
                  </button>
                </div>
              )}

              {/* Progress Indicator */}
              {downloadProgress && (
                <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-100 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
                      <span>
                        {downloadProgress.status === 'completed'
                          ? (lang === 'en' ? 'Download Complete!' : 'ማውረዱ ተጠናቋል!')
                          : (lang === 'en' ? 'Downloading Map Tiles...' : 'ካርታውን በማውረድ ላይ...')}
                      </span>
                    </div>
                    <span className="font-mono text-cyan-700">{downloadProgress.percent}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-cyan-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>
                      {downloadProgress.completed} / {downloadProgress.total} {lang === 'en' ? 'tiles' : 'ክፍሎች'} (Zoom {downloadProgress.currentZoom})
                    </span>

                    {downloadProgress.status === 'downloading' && (
                      <button
                        type="button"
                        onClick={handleCancelDownload}
                        className="text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        {lang === 'en' ? 'Cancel' : 'አቋርጥ'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!downloadProgress && (
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleStartDownload}
                    className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-cyan-600/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {meta.isDownloaded
                        ? (lang === 'en' ? 'Update Offline Pack' : 'ካርታውን አድስ')
                        : (lang === 'en' ? 'Download Map Now' : 'ካርታውን አሁን አውርድ')}
                    </span>
                  </button>

                  {meta.isDownloaded && (
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={handleDeleteCache}
                      title={lang === 'en' ? 'Delete offline map tiles' : 'የወረደውን ካርታ አጥፋ'}
                      className="p-3 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Storage Meta stats */}
              {meta.isDownloaded && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    {meta.tileCount} {lang === 'en' ? 'tiles stored' : 'የካርታ ክፍሎች'}
                  </span>
                  <span>
                    ~{meta.estimatedSizeMb} MB {lang === 'en' ? 'offline cache' : 'ስልክ ላይ ተቀምጧል'}
                  </span>
                </div>
              )}
            </div>

            {/* Offline Database Guarantee */}
            <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/60 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  {lang === 'en' ? 'Built-in Offline Transit System' : 'የተሟላ የጣቢያዎችና መስመሮች ዳታ'}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  {lang === 'en' 
                    ? 'All 85+ stations, 120+ minibus routes, transfers, and fare guidelines are permanently embedded on your device and always work without internet.' 
                    : 'ሁሉም 85+ ጣቢያዎች፣ 120+ የታክሲ መስመሮችና የጉዞ ታሪፎች በስልክዎ ላይ በቀጥታ የተጫኑ በመሆናቸው በማንኛውም ሰዓት ያለ ኢንተርኔት ይሰራሉ።'}
                </p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
              Taxi Tera Local Engine v1.0.4
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
            >
              {lang === 'en' ? 'Done' : 'ጨርስ'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
