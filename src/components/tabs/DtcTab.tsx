import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet,
  Radio,
  Cpu
} from 'lucide-react';
import { DtcRecord } from '../../types';
import { parseDtcString, parseDtcFromBytes } from '../../data/dtcDatabase';
import { transportManager } from '../../services/transportManager';
import { ecuSimulator } from '../../services/ecuSimulator';

interface DtcTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const DtcTab: React.FC<DtcTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';
  const [dtcs, setDtcs] = useState<DtcRecord[]>(isVirtual ? ecuSimulator.getState().dtcList : []);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedDtc, setSelectedDtc] = useState<DtcRecord | null>(isVirtual ? (dtcs[0] || null) : null);

  // Subscribe to transport state changes
  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Clear virtual DTCs when switching to Real Hardware
        setDtcs([]);
        setSelectedDtc(null);
      } else {
        const simDtcs = ecuSimulator.getState().dtcList;
        setDtcs(simDtcs);
        setSelectedDtc(simDtcs[0] || null);
      }
    });
    return unsub;
  }, []);

  // Manual Add DTC state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('P0101-16');

  // Read DTCs (0x19 02 08)
  const handleReadDtcs = async () => {
    const res = await transportManager.sendDiagnosticRequest(
      '19 02 08',
      '0x19 ReadDTCInformationByStatusMask (Mask: 0x08 Confirmed DTCs)'
    );

    if (res.status === 'OK') {
      const mode = transportManager.getState().mode;
      if (mode === 'virtual') {
        const updated = ecuSimulator.getState().dtcList;
        setDtcs(updated);
        if (updated.length > 0) setSelectedDtc(updated[0]);
      } else {
        // Parse raw bytes returned by physical vehicle hardware
        // Response to 0x19 02 08 starts with 59 02 [statusAvailabilityMask] followed by 4-byte records: [byte1, byte2, subType, status]
        const raw = res.rawBytes || res.response.split(' ').map(b => parseInt(b, 16));
        const parsedList: DtcRecord[] = [];
        if (raw.length >= 3 && raw[0] === 0x59) {
          for (let i = 3; i + 3 < raw.length; i += 4) {
            const b1 = raw[i];
            const b2 = raw[i + 1];
            const b3 = raw[i + 2];
            const st = raw[i + 3];
            const dtc = parseDtcFromBytes(b1, b2, b3, st);
            parsedList.push(dtc);
          }
        }
        setDtcs(parsedList);
        setSelectedDtc(parsedList[0] || null);
      }
    } else {
      if (transportManager.getState().mode !== 'virtual') {
        setDtcs([]);
        setSelectedDtc(null);
      }
    }
  };

  // Clear DTCs (0x14 FF FF FF)
  const handleClearDtcs = async () => {
    if (window.confirm('Send Service 0x14 to erase all Diagnostic Trouble Codes?')) {
      const res = await transportManager.sendDiagnosticRequest(
        '14 FF FF FF',
        '0x14 ClearDiagnosticInformation (All emission & chassis groups)'
      );
      if (res.status === 'OK') {
        if (transportManager.getState().mode === 'virtual') {
          ecuSimulator.clearDtcs();
        }
        setDtcs([]);
        setSelectedDtc(null);
      }
    }
  };

  // Add Test DTC (only allowed in virtual simulation mode)
  const handleAddDtc = () => {
    if (!newCode) return;
    if (transportManager.getState().mode !== 'virtual') {
      alert('Adding simulated DTCs is only available in Virtual ECU Simulator mode.');
      return;
    }
    const parsed = parseDtcString(newCode);
    ecuSimulator.addTestDtc(parsed);
    setDtcs(ecuSimulator.getState().dtcList);
    setSelectedDtc(parsed);
    setShowAddModal(false);
    onLog('INFO', `Simulated DTC Registered: ${parsed.code} - ${parsed.definition}`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (dtcs.length === 0) {
      alert('No DTCs to export.');
      return;
    }
    const headers = ['Code', 'Category', 'Scope', 'SubType', 'Definition', 'StatusByte'];
    const rows = dtcs.map(d => [
      `"${d.code}"`,
      `"${d.type}"`,
      `"${d.global}"`,
      `"${d.subType}"`,
      `"${d.definition.replace(/"/g, '""')}"`,
      `"${d.statusByte || '0x2F'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DTC_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered DTC list
  const filteredDtcs = dtcs.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.definition.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'P') return d.code.startsWith('P');
    if (categoryFilter === 'C') return d.code.startsWith('C');
    if (categoryFilter === 'B') return d.code.startsWith('B');
    if (categoryFilter === 'U') return d.code.startsWith('U');
    return true;
  });

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
                <strong>REAL HARDWARE MODE ACTIVE</strong> — Querying active trouble codes from physical vehicle ECU via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>. Simulated fault injection is disabled.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR MODE ACTIVE</strong> — In-browser virtual ECU memory loaded with simulated DTC faults.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Action Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handleReadDtcs}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Read DTCs (0x19)</span>
          </button>

          <button
            onClick={handleClearDtcs}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear DTCs (0x14)</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Test DTC</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or description..."
              className="bg-slate-950 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-52"
            />
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-700 rounded p-0.5 text-xs font-semibold">
            {['ALL', 'P', 'C', 'B', 'U'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  categoryFilter === cat ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Dual Pane: DTC Table & DTC Symptom Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* DTC Table Pane */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Fault Records ({filteredDtcs.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">SAE J2012 / ISO 14229 Format</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <tr>
                  <th className="py-2 px-3">DTC Code</th>
                  <th className="py-2 px-3">Scope</th>
                  <th className="py-2 px-3">Sub-Type / Symptom</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredDtcs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {transportState.mode === 'tauri_j2534' ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-300">No hardware DTCs read yet</p>
                          <p className="text-xs text-slate-500">Click &quot;Read DTCs (0x19)&quot; to query active diagnostic fault codes from vehicle ECU.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-300">Virtual ECU memory is clean</p>
                          <p className="text-xs text-slate-500">Click &quot;Add Test DTC&quot; to inject simulated fault codes into the virtual engine.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDtcs.map((dtc) => {
                    const isSelected = selectedDtc?.id === dtc.id;
                    const isPowertrain = dtc.code.startsWith('P');
                    const isChassis = dtc.code.startsWith('C');
                    const isBody = dtc.code.startsWith('B');
                    const isNetwork = dtc.code.startsWith('U');

                    const badgeColor = isPowertrain 
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800/80' 
                      : isChassis 
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/80' 
                      : isBody 
                      ? 'bg-blue-950/80 text-blue-300 border-blue-800/80' 
                      : 'bg-purple-950/80 text-purple-300 border-purple-800/80';

                    return (
                      <tr
                        key={dtc.id}
                        onClick={() => setSelectedDtc(dtc)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-950/40 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] ${badgeColor}`}>
                            {dtc.code}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">{dtc.global}</td>
                        <td className="py-2 px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">{dtc.subType.split(' - ')[0]}</td>
                        <td className="py-2 px-3 truncate max-w-xs">{dtc.definition}</td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-cyan-400 font-semibold">{dtc.statusByte}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DTC Detailed Inspector Pane */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Fault Inspector</h3>
              {selectedDtc && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {selectedDtc.code}
                </span>
              )}
            </div>

            {selectedDtc ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Full Diagnostic Code:</span>
                  <div className="font-mono text-base font-bold text-white mt-0.5">{selectedDtc.code}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block">Category & System:</span>
                  <div className="font-medium text-slate-200">{selectedDtc.type}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block">Failure Subtype / Symptom Byte:</span>
                  <div className="font-medium text-amber-300 bg-slate-950 p-2 rounded border border-slate-800 mt-1">
                    {selectedDtc.subType}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block">Definition / Description:</span>
                  <div className="text-slate-200 bg-slate-950 p-2.5 rounded border border-slate-800 mt-1 leading-relaxed">
                    {selectedDtc.definition}
                  </div>
                </div>

                {/* Status Byte Bit-Flags (ISO 14229-1 StatusOfDTC) */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px] block mb-2">
                    Status Byte Flags ({selectedDtc.statusByte}):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className={`w-2 h-2 rounded-full ${selectedDtc.statusFlags?.confirmedDTC ? 'bg-rose-500' : 'bg-slate-700'}`} />
                      <span className="text-slate-300">Confirmed (Bit 3)</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className={`w-2 h-2 rounded-full ${selectedDtc.statusFlags?.pendingDTC ? 'bg-amber-500' : 'bg-slate-700'}`} />
                      <span className="text-slate-300">Pending (Bit 2)</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className={`w-2 h-2 rounded-full ${selectedDtc.statusFlags?.testFailed ? 'bg-rose-500' : 'bg-slate-700'}`} />
                      <span className="text-slate-300">Test Failed (Bit 0)</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className={`w-2 h-2 rounded-full ${selectedDtc.statusFlags?.warningIndicatorRequested ? 'bg-amber-500' : 'bg-slate-700'}`} />
                      <span className="text-slate-300">MIL On (Bit 7)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Select a fault code from the table to view detailed symptoms and bit-flags.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Test DTC Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-800">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Simulate New Diagnostic Trouble Code</span>
            </h3>

            <div>
              <label className="text-slate-300 font-medium block mb-1">DTC Code (with optional sub-byte, e.g. P0300-14, U0100-87, C0031-11):</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="P0101-16"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-cyan-300 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Formats: Standard 5-digit (P0300) or extended 2-byte + 1-byte symptom (P0300-14).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDtc}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
              >
                Add Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
