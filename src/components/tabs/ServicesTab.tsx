import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Trash2, ToggleLeft, ToggleRight, Wrench, Shield, CheckCircle2, AlertCircle, Radio, Cpu } from 'lucide-react';
import { transportManager } from '../../services/transportManager';

interface ServicesTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
  onSessionChange: (name: string) => void;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({ onLog, onSessionChange }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());

  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
    });
    return unsub;
  }, []);

  // Session Control state
  const [selectedSession, setSelectedSession] = useState<string>('01');
  const [customSessionHex, setCustomSessionHex] = useState<string>('03');

  // Reset state
  const [resetType, setResetType] = useState<string>('01');

  // Routine Control state
  const [routineType, setRoutineType] = useState<string>('01');
  const [routineId, setRoutineId] = useState<string>('0201');
  const [routineData, setRoutineData] = useState<string>('');

  // Write DID state
  const [writeDid, setWriteDid] = useState<string>('F190');
  const [writeData, setWriteData] = useState<string>('31 46 54 46 57 31 45 44 34 4D 46 41 31 32 39 38 34');

  // DTC Setting (0x85)
  const [dtcSettingOn, setDtcSettingOn] = useState<boolean>(true);

  // Helper to execute service through transportManager
  const executeService = async (cmd: string, desc: string) => {
    return await transportManager.sendDiagnosticRequest(cmd, desc);
  };

  // 0x10 Diagnostic Session Control
  const handleSetSession = () => {
    const sub = selectedSession === 'custom' ? customSessionHex : selectedSession;
    const sessionLabels: Record<string, string> = {
      '01': 'Default Session (0x01)',
      '02': 'Programming Session (0x02)',
      '03': 'Extended Diagnostic Session (0x03)',
      '04': 'Safety System Diagnostic Session (0x04)',
      '81': 'KWP2000 Default Session ($81)',
      '85': 'KWP2000 ECU Programming ($85)',
      '87': 'KWP2000 ECU Adjustment ($87)'
    };
    const label = sessionLabels[sub] || `Custom Session 0x${sub}`;
    executeService(`10 ${sub}`, `0x10 DiagnosticSessionControl -> ${label}`);
    onSessionChange(label);
  };

  // 0x11 ECU Reset
  const handleResetEcu = () => {
    const resetLabels: Record<string, string> = {
      '01': 'Hard Reset (0x01)',
      '02': 'Key Off/On Reset (0x02)',
      '03': 'Soft Reset (0x03)',
      '04': 'Enable Rapid Power Shutdown (0x04)'
    };
    executeService(`11 ${resetType}`, `0x11 ECUReset -> ${resetLabels[resetType] || resetType}`);
    onSessionChange('Default Session');
  };

  // 0x14 Clear DTCs
  const handleClearDtcs = () => {
    if (window.confirm('Clear all Diagnostic Trouble Codes from target ECU?')) {
      executeService('14 FF FF FF', '0x14 ClearDiagnosticInformation (All Groups 0xFFFFFF)');
    }
  };

  // 0x85 Control DTC Setting
  const handleToggleDtcSetting = (enable: boolean) => {
    const sub = enable ? '01' : '02';
    setDtcSettingOn(enable);
    executeService(`85 ${sub}`, `0x85 ControlDTCSetting -> ${enable ? 'DTC Storage ON (0x01)' : 'DTC Storage OFF (0x02)'}`);
  };

  // 0x31 Routine Control
  const handleRoutineControl = () => {
    const cleanId = routineId.replace(/\s+/g, '');
    const cleanPayload = routineData.trim();
    const cmd = `31 ${routineType} ${cleanId} ${cleanPayload}`.trim();
    executeService(cmd, `0x31 RoutineControl (Type: 0x${routineType}, Routine ID: 0x${cleanId})`);
  };

  // 0x2E Write Data by Identifier
  const handleWriteDid = () => {
    const cleanDid = writeDid.replace(/\s+/g, '');
    const cleanBytes = writeData.replace(/\s+/g, ' ');
    const cmd = `2E ${cleanDid} ${cleanBytes}`.trim();
    executeService(cmd, `0x2E WriteDataByIdentifier (DID: 0x${cleanDid})`);
  };

  // 0x3E Tester Present
  const handleTesterPresent = (suppressPos: boolean) => {
    const sub = suppressPos ? '80' : '00';
    executeService(`3E ${sub}`, `0x3E TesterPresent (${suppressPos ? 'SuppressPosRspMsgIndicationBit=1' : 'Normal'})`);
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
                <strong>REAL HARDWARE UDS SERVICES ACTIVE</strong> — Diagnostic requests are transmitted directly onto vehicle bus via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR SERVICES ACTIVE</strong> — Emulating standard ISO 14229 responses on virtual ECU.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Grid of Diagnostic Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Service 0x10 DiagnosticSessionControl */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
                0x10
              </span>
              <h3 className="font-bold text-sm text-slate-100">Diagnostic Session Control</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Switch ECU diagnostic operating state between Default, Programming, and Extended mode.
            </p>

            <div className="space-y-2 text-xs">
              <label className="text-slate-300 font-medium">Session Type:</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="01">0x01 - Default Session</option>
                <option value="02">0x02 - Programming Session</option>
                <option value="03">0x03 - Extended Diagnostic Session</option>
                <option value="04">0x04 - Safety System Diagnostic</option>
                <option value="81">0x81 - KWP2000 Default Session</option>
                <option value="85">0x85 - KWP2000 ECU Programming</option>
                <option value="87">0x87 - KWP2000 ECU Adjustment</option>
                <option value="custom">Custom Session Sub-Function...</option>
              </select>

              {selectedSession === 'custom' && (
                <div className="pt-1">
                  <label className="text-slate-400 text-[11px]">Sub-Function Hex (e.g. 05, 40, 60):</label>
                  <input
                    type="text"
                    value={customSessionHex}
                    onChange={(e) => setCustomSessionHex(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-cyan-400 font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSetSession}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Send Session Control (0x10)</span>
          </button>
        </div>

        {/* Service 0x11 ECUReset */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
                0x11
              </span>
              <h3 className="font-bold text-sm text-slate-100">ECU Reset</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Force an internal reboot of the micro-controller or power supply stage.
            </p>

            <div className="space-y-2 text-xs">
              <label className="text-slate-300 font-medium">Reset Type:</label>
              <select
                value={resetType}
                onChange={(e) => setResetType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="01">0x01 - Hard Reset (Power cycle)</option>
                <option value="02">0x02 - Key Off / On Reset</option>
                <option value="03">0x03 - Soft Reset (Software restart)</option>
                <option value="04">0x04 - Enable Rapid Power Shutdown</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleResetEcu}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Execute ECU Reset (0x11)</span>
          </button>
        </div>

        {/* Service 0x14 Clear Diagnostic Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-mono text-xs font-bold border border-rose-800/60">
                0x14
              </span>
              <h3 className="font-bold text-sm text-slate-100">Clear Diagnostic Information</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Erase all stored Diagnostic Trouble Codes (DTCs), freeze frames, and readiness metrics across all groups.
            </p>

            <div className="bg-rose-950/30 border border-rose-900/50 rounded p-2.5 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>Broadcasts 0x14 FF FF FF to target ECU. Erases NVRAM fault records permanently.</span>
            </div>
          </div>

          <button
            onClick={handleClearDtcs}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All DTCs (0x14)</span>
          </button>
        </div>

        {/* Service 0x85 Control DTC Setting */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
                0x85
              </span>
              <h3 className="font-bold text-sm text-slate-100">Control DTC Setting</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Enable or suppress the recording of DTCs during active reflashing, tuning, or bench testing.
            </p>

            <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
              <span className="text-xs font-medium text-slate-200">
                Current State: <strong className={dtcSettingOn ? 'text-emerald-400' : 'text-amber-400'}>{dtcSettingOn ? 'ENABLED (0x01)' : 'SUPPRESSED (0x02)'}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleDtcSetting(true)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    dtcSettingOn ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ON (01)
                </button>
                <button
                  onClick={() => handleToggleDtcSetting(false)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    !dtcSettingOn ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  OFF (02)
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 mt-2">
            Standard OEM protocol mandates disabling DTC setting prior to flash payload upload.
          </div>
        </div>

        {/* Service 0x3E Tester Present */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
                0x3E
              </span>
              <h3 className="font-bold text-sm text-slate-100">Tester Present (Manual)</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Send an ISO 14229 keepalive ping to maintain active Extended or Programming sessions.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTesterPresent(false)}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs py-2 px-2 rounded font-semibold cursor-pointer"
              >
                <span>3E 00 (Normal)</span>
              </button>
              <button
                onClick={() => handleTesterPresent(true)}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs py-2 px-2 rounded font-semibold cursor-pointer"
              >
                <span>3E 80 (Suppressed)</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            Note: Automatic periodic keepalive can also be toggled from the top header bar.
          </p>
        </div>

        {/* Service 0x31 Routine Control */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
                0x31
              </span>
              <h3 className="font-bold text-sm text-slate-100">Routine Control</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Trigger built-in diagnostic self-tests (e.g. actuator tests, sensor calibrations).
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <label className="text-slate-400 text-[11px]">Type:</label>
                <select
                  value={routineType}
                  onChange={(e) => setRoutineType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                >
                  <option value="01">01 Start Routine</option>
                  <option value="02">02 Stop Routine</option>
                  <option value="03">03 Request Results</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[11px]">Routine ID (Hex):</label>
                <input
                  type="text"
                  value={routineId}
                  onChange={(e) => setRoutineId(e.target.value.toUpperCase())}
                  placeholder="0201"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-[11px]">Optional Routine Option Bytes (Hex):</label>
              <input
                type="text"
                value={routineData}
                onChange={(e) => setRoutineData(e.target.value.toUpperCase())}
                placeholder="00 FF 12"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleRoutineControl}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Send Routine Control (0x31)</span>
          </button>
        </div>

        {/* Service 0x2E Write Data by Identifier */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-cyan-400 font-mono text-xs font-bold border border-blue-800/60">
              0x2E
            </span>
            <h3 className="font-bold text-sm text-slate-100">Write Data by Identifier (DID)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Write configuration bytes, VIN, calibration factors, or customer adaptation records into EEPROM/Flash.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-300 font-medium">Target DID (Hex):</label>
              <input
                type="text"
                value={writeDid}
                onChange={(e) => setWriteDid(e.target.value.toUpperCase())}
                placeholder="F190"
                maxLength={4}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-cyan-300 font-mono font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-300 font-medium">Hex Data Payload (Bytes separated by space):</label>
              <input
                type="text"
                value={writeData}
                onChange={(e) => setWriteData(e.target.value.toUpperCase())}
                placeholder="31 46 54 46..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 font-mono"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleWriteDid}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Write DID (0x2E)</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
