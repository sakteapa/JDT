import React, { useState, useEffect } from 'react';
import { Car, CheckCircle2, XCircle, Search, RefreshCw, Globe, Factory, Calendar, ShieldCheck, Radio, Cpu } from 'lucide-react';
import { decodeVin, DecodedVin } from '../../services/vinDecoder';
import { transportManager } from '../../services/transportManager';

interface VinDecoderTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const VinDecoderTab: React.FC<VinDecoderTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';

  const [vinInput, setVinInput] = useState<string>(isVirtual ? '1FTFW1ED4MFA12984' : '');
  const [decoded, setDecoded] = useState<DecodedVin>(decodeVin(isVirtual ? '1FTFW1ED4MFA12984' : ''));

  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Clear simulated VIN
        setVinInput('');
        setDecoded(decodeVin(''));
      } else {
        setVinInput('1FTFW1ED4MFA12984');
        setDecoded(decodeVin('1FTFW1ED4MFA12984'));
      }
    });
    return unsub;
  }, []);

  const handleDecode = (vinToDecode?: string) => {
    const v = (vinToDecode || vinInput).trim().toUpperCase();
    const result = decodeVin(v);
    setDecoded(result);
  };

  // Read VIN directly from ECU via 0x22 F190
  const handleReadVinFromEcu = async () => {
    const res = await transportManager.sendDiagnosticRequest('22 F1 90', '0x22 ReadDataByIdentifier (DID: 0xF190 VIN)');
    if (res.status === 'OK') {
      // Response: 62 F1 90 [17 ASCII bytes]
      const parts = res.response.split(' ');
      const ascii = parts.slice(3).map(b => String.fromCharCode(parseInt(b, 16))).join('');
      if (ascii && ascii.length >= 11) {
        setVinInput(ascii);
        handleDecode(ascii);
      }
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
                <strong>REAL HARDWARE MODE ACTIVE</strong> — Click &quot;Read from ECU (DID 0xF190)&quot; to read live vehicle VIN via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR MODE ACTIVE</strong> — Loaded with simulated Ford F-150 production VIN.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>
      {/* Search and Retrieval Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Car className="w-4 h-4 text-cyan-400" />
            <span>ISO 3779 / 3780 VIN Decoder & Checksum Engine</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">17-Character Vehicle Serialization</span>
        </div>

        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div className="flex-1 min-w-[280px]">
            <label className="text-slate-400 text-[11px] block mb-1">Enter 17-Digit VIN Number:</label>
            <input
              type="text"
              value={vinInput}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setVinInput(upper);
                handleDecode(upper);
              }}
              placeholder="1FTFW1ED4MFA12984"
              maxLength={17}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-cyan-300 font-mono font-bold text-base tracking-widest focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => handleDecode()}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-4 rounded transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Decode VIN</span>
          </button>

          <button
            onClick={handleReadVinFromEcu}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-4 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Read from ECU (DID 0xF190)</span>
          </button>
        </div>

        {/* VIN 17-digit character segments visualization */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1 font-mono text-xs select-none">
            {vinInput.split('').map((char, index) => {
              let segmentColor = 'bg-slate-800 text-slate-300';
              let segmentLabel = '';

              if (index < 3) {
                segmentColor = 'bg-cyan-950 text-cyan-300 border-cyan-800'; // WMI
                segmentLabel = 'WMI';
              } else if (index < 8) {
                segmentColor = 'bg-blue-950 text-blue-300 border-blue-800'; // VDS
                segmentLabel = 'VDS';
              } else if (index === 8) {
                segmentColor = decoded.isValidChecksum 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                  : 'bg-amber-950 text-amber-300 border-amber-800'; // Checksum
                segmentLabel = 'CHK';
              } else if (index === 9) {
                segmentColor = 'bg-indigo-950 text-indigo-300 border-indigo-800'; // Year
                segmentLabel = 'YR';
              } else if (index === 10) {
                segmentColor = 'bg-purple-950 text-purple-300 border-purple-800'; // Plant
                segmentLabel = 'PLT';
              } else {
                segmentColor = 'bg-slate-800/90 text-slate-200 border-slate-700'; // VIS Serial
                segmentLabel = 'VIS';
              }

              return (
                <div key={index} className="flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 mb-0.5">{index + 1}</span>
                  <div className={`w-8 h-8 rounded border flex items-center justify-center font-bold ${segmentColor}`}>
                    {char}
                  </div>
                  <span className="text-[8px] text-slate-500 mt-0.5">{segmentLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Decoded Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        
        {/* Verification Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Checksum Verification</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              decoded.isValidChecksum 
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {decoded.isValidChecksum ? 'VALID ISO 3779' : 'MANUAL / UNVERIFIED'}
            </span>
          </div>

          <div className="space-y-1 text-slate-300">
            <span className="text-slate-500 text-[11px]">Position 9 Checksum Digit:</span>
            <div className="font-mono text-base font-bold text-white">
              {decoded.vin[8] || '—'}
            </div>
            <p className="text-[11px] text-slate-400">
              {decoded.isValidChecksum 
                ? 'Standard weighted modulo-11 calculation matches Position 9.' 
                : 'Check digit does not match standard North American / European ISO weighting.'}
            </p>
          </div>
        </div>

        {/* Manufacturer & Country (WMI) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>WMI (World Manufacturer)</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold text-xs">{decoded.wmi}</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-slate-500 text-[11px] block">Manufacturer:</span>
              <span className="font-semibold text-slate-200">{decoded.manufacturer}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Country & Region:</span>
              <span className="text-slate-300">{decoded.country} ({decoded.region})</span>
            </div>
          </div>
        </div>

        {/* Model & Body (VDS) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-cyan-400" />
              <span>VDS (Vehicle Descriptor)</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold text-xs">{decoded.vds}</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-slate-500 text-[11px] block">Platform / Model Series:</span>
              <span className="font-semibold text-slate-200">{decoded.model}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Body Architecture:</span>
              <span className="text-slate-300">{decoded.bodyStyle}</span>
            </div>
          </div>
        </div>

        {/* Model Year */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Model Year</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold text-xs">Pos 10: {decoded.vin[9] || '—'}</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 text-[11px] block">Production Model Year:</span>
            <div className="font-mono text-xl font-bold text-emerald-400">{decoded.year}</div>
          </div>
        </div>

        {/* Assembly Plant & VIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-cyan-400" />
              <span>Assembly Plant & Serial</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold text-xs">{decoded.vis}</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-slate-500 text-[11px] block">Manufacturing Plant:</span>
              <span className="text-slate-200 font-medium">{decoded.plant}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Sequential Serial Number:</span>
              <span className="font-mono text-white font-bold">{decoded.serialNumber}</span>
            </div>
          </div>
        </div>

        {/* Powertrain Specification */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-cyan-400" />
              <span>Engine Configuration</span>
            </span>
            <span className="font-mono text-xs text-slate-400">Powertrain</span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 text-[11px] block">Engine Specification:</span>
            <span className="text-slate-200 leading-relaxed block">{decoded.engineSpec}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
