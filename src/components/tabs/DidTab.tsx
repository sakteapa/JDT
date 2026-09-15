import React, { useState, useRef, useEffect } from 'react';
import { Database, Search, Play, Square, RefreshCw, Download, FileSpreadsheet, Eye, Tag, Radio, Cpu } from 'lucide-react';
import { DidRecord } from '../../types';
import { lookupDid, DID_DATABASE } from '../../data/didDatabase';
import { transportManager } from '../../services/transportManager';

interface DidTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

const VIRTUAL_INITIAL_DIDS: DidRecord[] = [
  {
    did: 'F190',
    definition: 'Vehicle Identification Number (VIN)',
    data: '31 46 54 46 57 31 45 44 34 4D 46 41 31 32 39 38 34',
    ascii: '1FTFW1ED4MFA12984',
    status: 'FOUND'
  },
  {
    did: 'F188',
    definition: 'Vehicle Manufacturer ECU Software Number (Strategy)',
    data: '46 4C 33 41 2D 31 34 43 32 30 34 2D 42 4C 48',
    ascii: 'FL3A-14C204-BLH',
    status: 'FOUND'
  },
  {
    did: 'F100',
    definition: 'Bootloader Software Version Number',
    data: '76 31 34 2E 30 32 2E 30 39 2D 50 52 4F 44',
    ascii: 'v14.02.09-PROD',
    status: 'FOUND'
  }
];

export const DidTab: React.FC<DidTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';

  const [singleDid, setSingleDid] = useState<string>('F190');
  const [didRecords, setDidRecords] = useState<DidRecord[]>(isVirtual ? VIRTUAL_INITIAL_DIDS : []);

  // Scanner state
  const [scanStart, setScanStart] = useState<string>('F180');
  const [scanEnd, setScanEnd] = useState<string>('F19E');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanCurrentDid, setScanCurrentDid] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentScanIntRef = useRef<number>(0);
  const endScanIntRef = useRef<number>(0);

  // Subscribe to transport state changes
  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Clear simulated records when in real hardware mode
        setDidRecords([]);
      } else {
        setDidRecords(VIRTUAL_INITIAL_DIDS);
      }
    });
    return unsub;
  }, []);

  // Read Single DID (0x22)
  const handleReadSingleDid = async (hexInput?: string) => {
    const targetDid = (hexInput || singleDid).trim().toUpperCase();
    const cmd = `22 ${targetDid.substring(0, 2)} ${targetDid.substring(2, 4)}`;

    const res = await transportManager.sendDiagnosticRequest(cmd, `0x22 ReadDataByIdentifier (DID: 0x${targetDid})`);
    const didDef = lookupDid(targetDid);

    if (res.status === 'OK') {
      // Response format: 62 [DID1] [DID2] [DATA...]
      const parts = res.response.split(' ');
      const rawData = parts.slice(3).join(' ');
      const ascii = parts.slice(3).map(b => {
        const c = parseInt(b, 16);
        return c >= 32 && c <= 126 ? String.fromCharCode(c) : '.';
      }).join('');

      const newRec: DidRecord = {
        did: targetDid,
        definition: didDef.name,
        data: rawData,
        ascii,
        status: 'FOUND'
      };

      setDidRecords(prev => [newRec, ...prev.filter(d => d.did !== targetDid)]);
    } else {
      const newRec: DidRecord = {
        did: targetDid,
        definition: didDef.name,
        data: `NRC 0x${res.nrc || '7F'}`,
        ascii: res.nrcMeaning || 'Negative Response',
        status: 'NRC_7F'
      };
      setDidRecords(prev => [newRec, ...prev.filter(d => d.did !== targetDid)]);
    }
  };

  // Range Scanner
  const startRangeScan = () => {
    const startInt = parseInt(scanStart, 16);
    const endInt = parseInt(scanEnd, 16);

    if (isNaN(startInt) || isNaN(endInt) || startInt > endInt) {
      alert('Invalid hex DID range. Start must be less than or equal to end.');
      return;
    }

    if (endInt - startInt > 256) {
      if (!window.confirm(`You are about to scan ${endInt - startInt + 1} DIDs. Continue?`)) {
        return;
      }
    }

    setIsScanning(true);
    currentScanIntRef.current = startInt;
    endScanIntRef.current = endInt;

    const scanNext = async () => {
      if (currentScanIntRef.current > endScanIntRef.current) {
        stopRangeScan();
        return;
      }

      const hexDid = currentScanIntRef.current.toString(16).toUpperCase().padStart(4, '0');
      setScanCurrentDid(hexDid);

      const cmd = `22 ${hexDid.substring(0, 2)} ${hexDid.substring(2, 4)}`;
      const res = await transportManager.sendDiagnosticRequest(cmd, `Range Scan DID 0x${hexDid}`, 60);
      const didDef = lookupDid(hexDid);

      if (res.status === 'OK') {
        const parts = res.response.split(' ');
        const rawData = parts.slice(3).join(' ');
        const ascii = parts.slice(3).map(b => {
          const c = parseInt(b, 16);
          return c >= 32 && c <= 126 ? String.fromCharCode(c) : '.';
        }).join('');

        const newRec: DidRecord = {
          did: hexDid,
          definition: didDef.name,
          data: rawData,
          ascii,
          status: 'FOUND'
        };
        setDidRecords(prev => [newRec, ...prev.filter(d => d.did !== hexDid)]);
      }

      currentScanIntRef.current++;
    };

    scanTimerRef.current = setInterval(scanNext, 80);
  };

  const stopRangeScan = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
      }
    };
  }, []);

  // Export to CSV
  const handleExportCsv = () => {
    if (didRecords.length === 0) {
      alert('No DIDs recorded.');
      return;
    }
    const headers = ['DID_Hex', 'Definition', 'Status', 'RawDataHex', 'DecodedASCII'];
    const rows = didRecords.map(d => [
      `"0x${d.did}"`,
      `"${d.definition.replace(/"/g, '""')}"`,
      `"${d.status}"`,
      `"${d.data || ''}"`,
      `"${(d.ascii || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DID_Dump_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = didRecords.filter(d => 
    d.did.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.definition.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (d.ascii && d.ascii.toLowerCase().includes(searchFilter.toLowerCase()))
  );

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
                <strong>REAL HARDWARE DID SCANNER ACTIVE</strong> — Communicating with vehicle ECU via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>. Only live vehicle DID responses will be displayed.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR DID SCANNER</strong> — Simulating standardized OEM DIDs (VIN, CalID, Hardware part numbers).
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Control Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Single DID Read Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>UDS 0x22: Read Data By Identifier (DID)</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">Single Query</span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Directly interrogate a 2-byte Data Identifier address (e.g. 0xF190 for VIN, 0xF188 for Strategy software).
            </p>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400 font-mono">0x</span>
              <input
                type="text"
                value={singleDid}
                onChange={(e) => setSingleDid(e.target.value.toUpperCase())}
                placeholder="F190"
                maxLength={4}
                className="w-28 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-cyan-300 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-sans truncate">
                {lookupDid(singleDid).name}
              </span>
            </div>

            {/* Quick DID Shortcut Tags */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-3">
              <span className="text-slate-400 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" /> Quick:
              </span>
              {[
                { did: 'F190', label: 'VIN' },
                { did: 'F188', label: 'Strategy' },
                { did: 'F110', label: 'DiagSpec' },
                { did: 'F113', label: 'ECU Name' },
                { did: 'F18C', label: 'Serial#' },
                { did: 'F100', label: 'Bootloader' }
              ].map(q => (
                <button
                  key={q.did}
                  onClick={() => {
                    setSingleDid(q.did);
                    handleReadSingleDid(q.did);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono cursor-pointer transition-colors"
                >
                  {q.did} ({q.label})
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleReadSingleDid()}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Send 0x22 {singleDid} Request</span>
          </button>
        </div>

        {/* DID Range Scanner Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                <span>DID Range Scanner & Sweep</span>
              </h3>
              <span className="text-[11px] font-mono text-amber-400">Sweeper Engine</span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Sequentially queries a hex address range to discover all supported DIDs populated in the target module.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Start DID (Hex):</label>
                <input
                  type="text"
                  value={scanStart}
                  onChange={(e) => setScanStart(e.target.value.toUpperCase())}
                  disabled={isScanning}
                  maxLength={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-cyan-300 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">End DID (Hex):</label>
                <input
                  type="text"
                  value={scanEnd}
                  onChange={(e) => setScanEnd(e.target.value.toUpperCase())}
                  disabled={isScanning}
                  maxLength={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-cyan-300 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isScanning ? (
              <button
                onClick={startRangeScan}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Sweep (0x{scanStart} - 0x{scanEnd})</span>
              </button>
            ) : (
              <button
                onClick={stopRangeScan}
                className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Sweep (Current: 0x{scanCurrentDid})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-200">Discovered DID Registers</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
              {filteredRecords.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter DIDs..."
                className="bg-slate-950 border border-slate-700 rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-48"
              />
            </div>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
              <tr>
                <th className="py-2 px-3">DID (Hex)</th>
                <th className="py-2 px-3">Parameter Definition</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Raw Response (Hex)</th>
                <th className="py-2 px-3">Decoded ASCII</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {transportState.mode === 'tauri_j2534' ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No hardware DID responses captured yet</p>
                        <p className="text-xs text-slate-500">Enter a 2-byte DID above and click &quot;Send 0x22 Request&quot; or start a sweep to interrogate vehicle module.</p>
                      </div>
                    ) : (
                      <p className="text-slate-500">No DIDs captured yet. Use &quot;Read DID&quot; or &quot;Start Sweep&quot; to scan the virtual ECU.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.did} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                      0x{rec.did}
                    </td>
                    <td className="py-2 px-3 text-slate-200">{rec.definition}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                        rec.status === 'FOUND' 
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {rec.status === 'FOUND' ? 'POSITIVE (62)' : 'NRC 0x7F'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-300 text-[11px] truncate max-w-xs">
                      {rec.data || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-emerald-400 text-[11px] truncate max-w-xs">
                      {rec.ascii || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
