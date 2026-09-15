import React, { useState, useEffect, useRef } from 'react';
import { Gauge, Activity, RefreshCw, Car, CheckCircle2, AlertTriangle, ShieldCheck, Radio, Cpu } from 'lucide-react';
import { transportManager } from '../../services/transportManager';

interface ObdTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const ObdTab: React.FC<ObdTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';

  const [activeMode, setActiveMode] = useState<'01' | '02' | '09'>('01');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);

  // Live PID state
  const [rpm, setRpm] = useState<number | null>(isVirtual ? 820 : null);
  const [speed, setSpeed] = useState<number | null>(isVirtual ? 0 : null);
  const [coolant, setCoolant] = useState<number | null>(isVirtual ? 88 : null);
  const [throttle, setThrottle] = useState<number | null>(isVirtual ? 14.2 : null);
  const [maf, setMaf] = useState<number | null>(isVirtual ? 3.8 : null);
  const [voltage, setVoltage] = useState<number | null>(isVirtual ? 13.8 : null);
  const [fuelTrim, setFuelTrim] = useState<number | null>(isVirtual ? 0.8 : null);
  const [calcLoad, setCalcLoad] = useState<number | null>(isVirtual ? 24.5 : null);

  // Mode 09 State
  const [mode09Vin, setMode09Vin] = useState<string>(isVirtual ? '1FTFW1ED4MFA12984' : '--');
  const [mode09CalId, setMode09CalId] = useState<string>(isVirtual ? 'FL3A-14C204-BLH' : '--');
  const [mode09Cvn, setMode09Cvn] = useState<string>(isVirtual ? '9E4B821A' : '--');

  // Track mode change
  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Reset simulated values when switching to Real Hardware
        setRpm(null);
        setSpeed(null);
        setCoolant(null);
        setThrottle(null);
        setMaf(null);
        setVoltage(null);
        setFuelTrim(null);
        setCalcLoad(null);
        setMode09Vin('--');
        setMode09CalId('--');
        setMode09Cvn('--');
      } else {
        // Virtual mode defaults
        setRpm(820);
        setSpeed(0);
        setCoolant(88);
        setThrottle(14.2);
        setMaf(3.8);
        setVoltage(13.8);
        setFuelTrim(0.8);
        setCalcLoad(24.5);
        setMode09Vin('1FTFW1ED4MFA12984');
        setMode09CalId('FL3A-14C204-BLH');
        setMode09Cvn('9E4B821A');
      }
    });
    return unsub;
  }, []);

  // Polling loop: Virtual jitter OR Real Hardware J2534 requests
  useEffect(() => {
    if (!isLiveStreaming) return;

    if (transportState.mode === 'virtual') {
      // Virtual mode simulation jitter
      const interval = setInterval(() => {
        setRpm(prev => Math.min(6500, Math.max(650, (prev || 800) + Math.floor((Math.random() - 0.48) * 40))));
        setThrottle(prev => +(Math.max(12, Math.min(85, (prev || 14) + (Math.random() - 0.5) * 0.8))).toFixed(1));
        setMaf(prev => +(Math.max(2.5, Math.min(180, (prev || 3.5) + (Math.random() - 0.5) * 0.3))).toFixed(2));
        setVoltage(prev => +(13.8 + (Math.random() - 0.5) * 0.1).toFixed(1));
        setFuelTrim(prev => +(Math.max(-15, Math.min(15, (prev || 0) + (Math.random() - 0.5) * 0.4))).toFixed(1));
        setCalcLoad(prev => +(Math.max(10, Math.min(95, (prev || 25) + (Math.random() - 0.5) * 0.6))).toFixed(1));
      }, 400);
      return () => clearInterval(interval);
    } else {
      // Real Hardware Mode: strictly poll real CAN bus without fake numbers
      let isSubscribed = true;
      const interval = setInterval(async () => {
        if (!isSubscribed) return;
        if (!transportState.connected) return;

        // Poll RPM: 01 0C
        try {
          const res = await transportManager.sendDiagnosticRequest('01 0C', 'OBD-II 0x01 PID 0x0C Engine RPM', 150);
          if (res.status === 'OK' && isSubscribed) {
            const parts = res.response.split(' ');
            // Expected: 41 0C A B
            if (parts.length >= 4 && parts[0] === '41') {
              const a = parseInt(parts[2], 16);
              const b = parseInt(parts[3], 16);
              const realRpm = Math.round(((a * 256) + b) / 4);
              setRpm(realRpm);
            }
          }
        } catch {
          // Bus timeout or error
        }
      }, 800);

      return () => {
        isSubscribed = false;
        clearInterval(interval);
      };
    }
  }, [isLiveStreaming, transportState.mode, transportState.connected]);

  // Request specific Mode 01 PID
  const requestPid = async (pidHex: string, name: string) => {
    const res = await transportManager.sendDiagnosticRequest(`01 ${pidHex}`, `OBD-II Mode 01 Request: ${name} (PID 0x${pidHex})`);
    if (res.status === 'OK') {
      const parts = res.response.split(' ');
      if (parts.length >= 3 && parts[0] === '41') {
        const a = parseInt(parts[2], 16);
        if (pidHex === '0C' && parts.length >= 4) {
          const b = parseInt(parts[3], 16);
          setRpm(Math.round(((a * 256) + b) / 4));
        } else if (pidHex === '0D') {
          setSpeed(a);
        } else if (pidHex === '05') {
          setCoolant(a - 40);
        } else if (pidHex === '11') {
          setThrottle(+((a * 100) / 255).toFixed(1));
        } else if (pidHex === '10' && parts.length >= 4) {
          const b = parseInt(parts[3], 16);
          setMaf(+(((a * 256) + b) / 100).toFixed(2));
        } else if (pidHex === '06') {
          setFuelTrim(+((a - 128) * 100 / 128).toFixed(1));
        } else if (pidHex === '04') {
          setCalcLoad(+((a * 100) / 255).toFixed(1));
        }
      }
    }
  };

  // Request Mode 09 Vehicle Info
  const requestMode09 = async () => {
    const resVin = await transportManager.sendDiagnosticRequest('09 02', 'OBD-II Mode 09 PID 0x02 Request: Vehicle Identification Number (VIN)');
    if (resVin.status === 'OK') {
      const parts = resVin.response.split(' ').slice(3);
      const decodedVin = parts.map(b => String.fromCharCode(parseInt(b, 16))).join('');
      if (decodedVin) setMode09Vin(decodedVin);
    }

    const resCal = await transportManager.sendDiagnosticRequest('09 04', 'OBD-II Mode 09 PID 0x04 Request: Calibration Identification (CalID)');
    if (resCal.status === 'OK') {
      const parts = resCal.response.split(' ').slice(3);
      const decodedCal = parts.map(b => String.fromCharCode(parseInt(b, 16))).join('');
      if (decodedCal) setMode09CalId(decodedCal);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Mode Status Banner */}
      <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
        transportState.mode === 'tauri_j2534'
          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
          : 'bg-cyan-950/40 border-cyan-800 text-cyan-300'
      }`}>
        <div className="flex items-center gap-2">
          {transportState.mode === 'tauri_j2534' ? (
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>
            {transportState.mode === 'tauri_j2534' ? (
              <>
                <strong>REAL HARDWARE MODE ACTIVE</strong> — Querying physical vehicle CAN bus via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>. Simulated data is completely disabled.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR MODE ACTIVE</strong> — Software loopback engine simulator running.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'BUS STANDBY'}
        </span>
      </div>

      {/* Sub-mode Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMode('01')}
            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              activeMode === '01' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Mode $01: Live Sensor Telemetry
          </button>
          <button
            onClick={() => setActiveMode('02')}
            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              activeMode === '02' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Mode $02: Freeze Frame
          </button>
          <button
            onClick={() => {
              setActiveMode('09');
              requestMode09();
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              activeMode === '09' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Mode $09: Vehicle Information
          </button>
        </div>

        {activeMode === '01' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                isLiveStreaming 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-pulse text-emerald-400' : ''}`} />
              <span>Live PID Polling: {isLiveStreaming ? 'ACTIVE' : 'PAUSED'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode 01: Live Gauge & Metrics Grid */}
      {activeMode === '01' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Engine RPM */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Engine Speed (RPM)</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x0C</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-cyan-400">
                  {rpm !== null ? rpm : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">RPM</span>
              </div>
              <button
                onClick={() => requestPid('0C', 'Engine RPM')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x0C
              </button>
            </div>

            {/* Vehicle Speed */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Vehicle Speed</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x0D</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-white">
                  {speed !== null ? speed : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">km/h</span>
              </div>
              <button
                onClick={() => requestPid('0D', 'Vehicle Speed')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x0D
              </button>
            </div>

            {/* Engine Coolant Temp */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Coolant Temperature</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x05</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-emerald-400">
                  {coolant !== null ? coolant : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">°C</span>
              </div>
              <button
                onClick={() => requestPid('05', 'Engine Coolant Temp')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x05
              </button>
            </div>

            {/* Throttle Position */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Throttle Position</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x11</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-amber-300">
                  {throttle !== null ? throttle : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">%</span>
              </div>
              <button
                onClick={() => requestPid('11', 'Throttle Position')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x11
              </button>
            </div>

            {/* Mass Air Flow (MAF) */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Mass Air Flow (MAF)</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x10</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-200">
                  {maf !== null ? maf : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">g/s</span>
              </div>
              <button
                onClick={() => requestPid('10', 'Mass Air Flow')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x10
              </button>
            </div>

            {/* Battery Voltage */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Module Voltage</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x42</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-emerald-300">
                  {voltage !== null ? voltage : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">V</span>
              </div>
              <button
                onClick={() => requestPid('42', 'Control Module Voltage')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x42
              </button>
            </div>

            {/* Short Term Fuel Trim */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Short Term Fuel Trim</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x06</span>
              </div>
              <div className="py-4 text-center">
                <span className={`text-3xl font-black font-mono tracking-tight ${
                  (fuelTrim || 0) > 0 ? 'text-amber-400' : 'text-cyan-300'
                }`}>
                  {fuelTrim !== null ? `${fuelTrim > 0 ? '+' : ''}${fuelTrim}` : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">%</span>
              </div>
              <button
                onClick={() => requestPid('06', 'Short Term Fuel Trim Bank 1')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x06
              </button>
            </div>

            {/* Calculated Engine Load */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold">Calculated Engine Load</span>
                <span className="font-mono text-[11px] text-cyan-400">PID 0x04</span>
              </div>
              <div className="py-4 text-center">
                <span className="text-3xl font-black font-mono tracking-tight text-rose-400">
                  {calcLoad !== null ? calcLoad : '--'}
                </span>
                <span className="text-xs text-slate-400 ml-1">%</span>
              </div>
              <button
                onClick={() => requestPid('04', 'Calculated Engine Load')}
                className="w-full text-center text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 py-1 rounded border border-slate-800 cursor-pointer"
              >
                Poll PID 0x04
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Mode 02: Freeze Frame */}
      {activeMode === '02' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-100">OBD-II Mode $02: Freeze Frame Diagnostics</h3>
              <p className="text-xs text-slate-400">Snapshot of engine operating parameters at the exact moment DTC was logged.</p>
            </div>
            {transportState.mode === 'virtual' ? (
              <span className="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono text-xs font-bold">
                Virtual Trigger DTC: P0300
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                Hardware Mode: Query vehicle via 0x02
              </span>
            )}
          </div>

          {transportState.mode === 'virtual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">DTC That Caused Freeze Frame:</span>
                <span className="font-mono text-base font-bold text-rose-400 mt-1 block">P0300 (Random Misfire)</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Engine RPM at Fault:</span>
                <span className="font-mono text-base font-bold text-cyan-400 mt-1 block">2,480 RPM</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Vehicle Speed at Fault:</span>
                <span className="font-mono text-base font-bold text-white mt-1 block">68 km/h</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Coolant Temp at Fault:</span>
                <span className="font-mono text-base font-bold text-emerald-400 mt-1 block">92 °C</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Fuel System Status:</span>
                <span className="font-mono text-base font-bold text-slate-200 mt-1 block">Closed Loop (Bank 1)</span>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Calculated Load Value:</span>
                <span className="font-mono text-base font-bold text-amber-300 mt-1 block">62.4 %</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-950 rounded border border-slate-800">
              <p>In Real Hardware Mode, freeze frame parameters are retrieved by querying the vehicle's ECU freeze frame buffer (0x02).</p>
              <button
                onClick={() => transportManager.sendDiagnosticRequest('02 02 00', 'OBD-II 0x02 Request Freeze Frame DTC')}
                className="mt-3 px-4 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-medium"
              >
                Read Mode $02 Freeze Frame
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 09: Vehicle Info */}
      {activeMode === '09' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                <span>OBD-II Mode $09: Vehicle Information</span>
              </h3>
              <p className="text-xs text-slate-400">Electronic serialization and calibration certificates read via standard PID query.</p>
            </div>
            <button
              onClick={requestMode09}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Query Mode $09</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[11px]">PID 0x02: VIN</span>
              <div className="font-mono text-lg font-bold text-cyan-400 tracking-wider mt-1">{mode09Vin}</div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-2">
                {mode09Vin !== '--' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Validated VIN Retrieved
                  </span>
                ) : (
                  <span>Click 'Query Mode $09' to read from vehicle</span>
                )}
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[11px]">PID 0x04: Calibration ID (CalID)</span>
              <div className="font-mono text-lg font-bold text-amber-300 tracking-wider mt-1">{mode09CalId}</div>
              <span className="text-[11px] text-slate-400 block mt-2">PCM Primary Strategy Assembly</span>
            </div>

            <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[11px]">PID 0x06: CVN (Verification Number)</span>
              <div className="font-mono text-lg font-bold text-emerald-400 tracking-wider mt-1">{mode09Cvn}</div>
              <span className="text-[11px] text-slate-400 block mt-2">Emissions Anti-Tamper Checksum</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
