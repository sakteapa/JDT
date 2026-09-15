import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  Activity, 
  Power, 
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Info, 
  Binary, 
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Usb,
  Download,
  FolderArchive,
  Terminal,
  X
} from 'lucide-react';
import { J2534Device, J2534DeviceInfo, CanBusType, DiagnosticProtocol } from '../types';
import { TransportType, transportManager } from '../services/transportManager';

interface HeaderProps {
  device: J2534Device;
  setDevice: (d: J2534Device) => void;
  busType: CanBusType;
  setBusType: (b: CanBusType) => void;
  protocol: DiagnosticProtocol;
  setProtocol: (p: DiagnosticProtocol) => void;
  ecuRx: string;
  setEcuRx: (rx: string) => void;
  ecuTx: string;
  setEcuTx: (tx: string) => void;
  is29Bit: boolean;
  setIs29Bit: (v: boolean) => void;
  connected: boolean;
  onToggleConnect: () => void;
  sessionName: string;
  isUnlocked: boolean;
  testerPresent: boolean;
  onToggleTesterPresent: () => void;
  onOpenHex2Dec: () => void;
  onOpenAbout: () => void;
  transportMode?: TransportType;
  onSetTransportMode?: (mode: TransportType) => void;
  vBat?: number;
}

export const Header: React.FC<HeaderProps> = ({
  device,
  setDevice,
  busType,
  setBusType,
  protocol,
  setProtocol,
  ecuRx,
  setEcuRx,
  ecuTx,
  setEcuTx,
  is29Bit,
  setIs29Bit,
  connected,
  onToggleConnect,
  sessionName,
  isUnlocked,
  testerPresent,
  onToggleTesterPresent,
  onOpenHex2Dec,
  onOpenAbout,
  transportMode = 'virtual',
  onSetTransportMode,
  vBat = 12.64
}) => {
  const [availableDevices, setAvailableDevices] = useState<J2534DeviceInfo[]>(transportManager.getAvailableDevices());
  const [isScanning, setIsScanning] = useState<boolean>(transportManager.getState().isScanningRegistry);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [showInstallerModal, setShowInstallerModal] = useState<boolean>(false);

  useEffect(() => {
    const unsub = transportManager.subscribeState((st) => {
      setAvailableDevices(transportManager.getAvailableDevices());
      setIsScanning(st.isScanningRegistry);
    });
    return unsub;
  }, []);

  const handleScanRegistry = async () => {
    try {
      await transportManager.scanWindowsRegistry();
    } catch (err) {
      console.error('Failed to scan Windows registry:', err);
    }
  };

  const handleProbeCurrentDevice = async (targetDeviceName?: string) => {
    const devToProbe = targetDeviceName || device;
    setIsProbing(true);
    try {
      await transportManager.probeDevice(devToProbe);
    } catch (err) {
      console.error('Failed to probe device hardware:', err);
    } finally {
      setIsProbing(false);
    }
  };

  const currentDevInfo = transportManager.getDeviceInfo(device);
  const isRealHardware = transportMode === 'tauri_j2534' || (currentDevInfo && currentDevInfo.isRealHardware && device !== 'Virtual ECU Simulator (CAN & UDS)');

  // Group devices for clear dropdown organization
  const virtualDevices = availableDevices.filter(d => !d.isRealHardware);
  const registryDevices = availableDevices.filter(d => d.isRealHardware && d.isRegistryDetected);
  const presetDevices = availableDevices.filter(d => d.isRealHardware && !d.isRegistryDetected);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top branding bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black tracking-tighter text-white text-xs shadow-inner">
            GDT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide text-white uppercase">
                Generic Diagnostic Tool
              </h1>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                v1.2.0 • J2534 PassThru
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Tester Present Specialist Automotive Solutions
            </p>
          </div>
        </div>

        {/* Status Indicators & Fast Tools */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Transport Mode Switcher Pill */}
          <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded p-0.5">
            <button
              onClick={() => onSetTransportMode && onSetTransportMode('virtual')}
              disabled={connected}
              title="Switch to in-browser Virtual ECU Simulator"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition-all cursor-pointer ${
                transportMode === 'virtual'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              } disabled:opacity-60`}
            >
              <Cpu className="w-3 h-3" />
              <span>Virtual Mode</span>
            </button>
            <button
              onClick={() => onSetTransportMode && onSetTransportMode('tauri_j2534')}
              disabled={connected}
              title="Switch to Real Hardware J2534 PassThru (Automatically uses detected hardware from Windows Registry, e.g. Zenith Z5 PassThru)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition-all cursor-pointer ${
                transportMode === 'tauri_j2534'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              } disabled:opacity-60`}
            >
              <Radio className="w-3 h-3" />
              <span>Real Hardware</span>
            </button>
          </div>

          {/* Battery Voltage */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700/80 text-emerald-400">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>VBAT: <strong className="font-semibold text-white">{vBat.toFixed(1)}V</strong></span>
          </div>

          {/* Diagnostic Session badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700/80">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Session:</span>
            <span className="text-cyan-300 font-semibold">{sessionName}</span>
          </div>

          {/* Security Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700/80">
            {isUnlocked ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">SECURITY UNLOCKED</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">LOCKED</span>
              </>
            )}
          </div>

          {/* Tester Present Heartbeat */}
          <button
            onClick={onToggleTesterPresent}
            title="0x3E Tester Present Keepalive Signal"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              testerPresent 
                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 font-semibold' 
                : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${testerPresent ? 'text-emerald-400 animate-ping' : 'text-slate-500'}`} />
            <span>0x3E KeepAlive {testerPresent ? 'ON' : 'OFF'}</span>
          </button>

          {/* Tools & Info buttons */}
          <button
            onClick={() => setShowInstallerModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-cyan-900/80 to-blue-900/80 hover:from-cyan-800 hover:to-blue-800 border border-cyan-500/50 text-cyan-200 font-medium cursor-pointer shadow-sm"
            title="Download / Build Windows .exe Installer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Installer (.exe)</span>
          </button>

          <button
            onClick={onOpenHex2Dec}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
            title="Hex / Dec / Binary Converter & NRC Guide"
          >
            <Binary className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hex2Dec</span>
          </button>

          <button
            onClick={onOpenAbout}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
            title="Information & Documentation"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Connection Toolbar */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-3 text-xs bg-slate-900/90">
        {/* Device select */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-400 font-medium whitespace-nowrap">Interface:</label>
          <select
            value={device}
            onChange={(e) => {
              const selected = e.target.value as J2534Device;
              setDevice(selected);
              if (selected !== 'Virtual ECU Simulator (CAN & UDS)') {
                handleProbeCurrentDevice(selected);
              }
            }}
            disabled={connected}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-60 font-mono max-w-[320px]"
          >
            {virtualDevices.length > 0 && (
              <optgroup label="── Virtual Simulation ──">
                {virtualDevices.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            )}

            {registryDevices.length > 0 && (
              <optgroup label="── Windows Registry (Detected Drivers) ──">
                {registryDevices.map((d) => {
                  const isConn = d.isConnected ?? false;
                  const label = d.displayName || (isConn ? `${d.name} (Connected & Ready)` : `${d.name} (Not Connected / Offline)`);
                  return (
                    <option key={d.name} value={d.name}>
                      {isConn ? '✓ ' : '✗ '} {label}
                    </option>
                  );
                })}
              </optgroup>
            )}

            {presetDevices.length > 0 && (
              <optgroup label="── Known J2534 Profiles ──">
                {presetDevices.map((d) => {
                  const isConn = d.isConnected ?? false;
                  const label = d.displayName || (isConn ? `${d.name} (Connected & Ready)` : `${d.name} (Not Connected / Offline)`);
                  return (
                    <option key={d.name} value={d.name}>
                      {isConn ? '✓ ' : '✗ '} {label}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>

          {/* Registry Scan Button */}
          <button
            onClick={handleScanRegistry}
            disabled={connected || isScanning}
            title="Scan Windows Registry for J2534 PassThru Drivers (HKLM\SOFTWARE\PassThruSupport.04.04 & HKLM\SOFTWARE\SAE International\J2534)"
            className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-all flex items-center gap-1.5 text-[11px] cursor-pointer font-sans"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-300' : ''}`} />
            <span className="hidden sm:inline">Scan Registry</span>
          </button>

          {/* Hardware USB Probe Button */}
          {currentDevInfo && currentDevInfo.isRealHardware && (
            <button
              onClick={() => handleProbeCurrentDevice(device)}
              disabled={connected || isProbing}
              title="Test physical USB connection and PassThruOpen response for active interface"
              className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-all flex items-center gap-1.5 text-[11px] cursor-pointer font-sans"
            >
              <Usb className={`w-3.5 h-3.5 ${isProbing ? 'animate-bounce text-amber-300' : ''}`} />
              <span className="hidden sm:inline">{isProbing ? 'Testing USB...' : 'Test USB'}</span>
            </button>
          )}

          {/* Active Hardware Connection Status & DLL Tags */}
          {currentDevInfo && currentDevInfo.isRealHardware && (
            <div className="flex items-center gap-1.5">
              {currentDevInfo.isConnected ? (
                <span
                  title={`USB Bus Status: Physically Connected & Active\nVendor: ${currentDevInfo.vendor}\nDLL: ${currentDevInfo.dllPath}`}
                  className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/70 flex items-center gap-1.5 shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  CONNECTED & READY
                </span>
              ) : (
                <span
                  title={currentDevInfo.probeError || 'Hardware not detected on USB bus (ERR_DEVICE_NOT_CONNECTED 0x03)'}
                  className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-rose-950/80 text-rose-300 border border-rose-700/80 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  NOT CONNECTED / OFFLINE
                </span>
              )}

              <span
                title={`Hardware DLL Path: ${currentDevInfo.dllPath}\nVendor: ${currentDevInfo.vendor}\nRegistry: ${currentDevInfo.registryPath || 'HKLM\\SOFTWARE\\PassThruSupport.04.04\\' + currentDevInfo.name}`}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700 hidden md:inline-flex items-center gap-1"
              >
                <span className="text-slate-400">DLL:</span> {currentDevInfo.dllPath.split('\\').pop() || currentDevInfo.dllPath}
              </span>

              {currentDevInfo.isRegistryDetected && (
                <span
                  title={`Detected via Windows Registry: ${currentDevInfo.registryPath}`}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950 text-blue-300 border border-blue-700/60 hidden lg:inline-flex items-center gap-1 font-semibold"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                  REGISTRY DETECTED
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bus Type */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-400 font-medium whitespace-nowrap">Bus:</label>
          <select
            value={busType}
            onChange={(e) => setBusType(e.target.value as CanBusType)}
            disabled={connected}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-60"
          >
            <option value="High Speed CAN (500k)">High Speed CAN (500k)</option>
            <option value="Medium Speed CAN (125k)">Medium Speed CAN (125k)</option>
            <option value="Medium Speed CAN (250k)">Medium Speed CAN (250k)</option>
            <option value="K-Line (ISO 9141 / 14230)">K-Line (ISO 9141 / 14230)</option>
          </select>
        </div>

        {/* Protocol Select */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-400 font-medium whitespace-nowrap">Protocol:</label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as DiagnosticProtocol)}
            disabled={connected}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-60"
          >
            <option value="ISO 15765-4 CAN (11-Bit 500K)">ISO 15765-4 CAN (11-Bit)</option>
            <option value="ISO 15765-4 CAN (29-Bit 500K)">ISO 15765-4 CAN (29-Bit)</option>
            <option value="ISO 14230-4 KWP2000">ISO 14230-4 KWP2000</option>
            <option value="ISO 9141-2 K-Line">ISO 9141-2 K-Line</option>
          </select>
        </div>

        {/* ECU RX / TX addresses */}
        <div className="flex items-center gap-1.5 font-mono">
          <label className="text-slate-400 font-medium whitespace-nowrap">RX:</label>
          <input
            type="text"
            value={ecuRx}
            onChange={(e) => setEcuRx(e.target.value.toUpperCase())}
            disabled={connected}
            maxLength={8}
            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold text-center focus:outline-none focus:border-cyan-500 disabled:opacity-60"
          />
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <label className="text-slate-400 font-medium whitespace-nowrap">TX:</label>
          <input
            type="text"
            value={ecuTx}
            onChange={(e) => setEcuTx(e.target.value.toUpperCase())}
            disabled={connected}
            maxLength={8}
            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold text-center focus:outline-none focus:border-cyan-500 disabled:opacity-60"
          />
        </div>

        {/* 29-Bit ID Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={is29Bit}
            onChange={(e) => setIs29Bit(e.target.checked)}
            disabled={connected}
            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span className="text-[11px]">29-Bit IDs</span>
        </label>

        {/* Connect / Disconnect button */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleConnect}
            className={`flex items-center gap-2 px-4 py-1.5 rounded font-bold transition-all cursor-pointer shadow-sm ${
              connected
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{connected ? 'DISCONNECT' : 'CONNECT'}</span>
          </button>
        </div>
      </div>

      {/* Windows Installer / Export Modal */}
      {showInstallerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Windows Installer (.exe / .msi)</h3>
                  <p className="text-xs text-slate-400">Tauri Native Desktop Build for SAE J2534 Flasher</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallerModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto">
              <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-200">
                <p className="font-semibold text-cyan-300 mb-1">ℹ️ Cloud Sandbox Notice (Linux)</p>
                <p className="leading-relaxed">
                  He development web container hi <strong>Linux</strong> a nih avangin Windows native binary (<code className="text-cyan-100 bg-cyan-900/50 px-1 py-0.5 rounded">.exe / .msi</code>) chu Windows khawl (PC) emaw GitHub Actions automated builder-ah chauh a siam theih a ni.
                </p>
              </div>

              {/* Method 1: Automated 1-Click Windows Build */}
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <FolderArchive className="w-4 h-4 text-cyan-400" />
                  <span>KHAWL (WINDOWS PC)-A INSTALLER SIAM DAN:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300 leading-relaxed">
                  <li>
                    A chunga <strong>Settings (dot 3)</strong> menu-ah kal la, <strong>Export to ZIP</strong> emaw <strong>Export to GitHub</strong> hmetin project hi download rawh.
                  </li>
                  <li>
                    ZIP file kha Windows PC-ah unzip la, folder chhungah khan lut rawh.
                  </li>
                  <li>
                    Folder chhunga awm <code className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono border border-slate-700">build-windows.bat</code> file kha <strong>Double-Click</strong> tawp rawh.
                  </li>
                  <li>
                    Amah ngeiin NPM dependencies leh Tauri Windows <code className="text-emerald-300 font-mono">.exe</code> &amp; <code className="text-emerald-300 font-mono">.msi</code> installer a compile chhuak nghal vek ang!
                  </li>
                </ol>
                <div className="mt-2 p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[11px] text-slate-400">
                  📁 <span className="text-slate-300">Target Output Location:</span><br />
                  <span className="text-emerald-400">src-tauri\target\release\bundle\msi\ECU UDS J2534 Flasher_1.0.0_x64_en-US.msi</span><br />
                  <span className="text-cyan-400">src-tauri\target\release\ECU UDS J2534 Flasher.exe</span>
                </div>
              </div>

              {/* Method 2: Manual Terminal Commands */}
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Terminal / Command Prompt Hmanga Build Dan:</span>
                </div>
                <p className="text-slate-400">Windows PowerShell emaw CMD-ah heng command hi run rawh:</p>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded font-mono text-emerald-400 overflow-x-auto text-[11px] select-all">
npm install
npm run tauri build
                </pre>
              </div>

              {/* Method 3: GitHub Actions */}
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <span>☁️ GitHub Actions Automated Release:</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Project chhungah <code className="text-slate-200 font-mono">.github/workflows/build-tauri-installer.yml</code> workflow kan siam sa diam tawh a. GitHub-a i export hian GitHub server-in amahin Windows <code className="text-emerald-300 font-mono">.exe</code> leh <code className="text-emerald-300 font-mono">.msi</code> installer a compile ang a, <strong>Releases</strong> tab-ah download turin a dah chhuak nghal ang!
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-800/80 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setShowInstallerModal(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Ka Hrethiam e (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

