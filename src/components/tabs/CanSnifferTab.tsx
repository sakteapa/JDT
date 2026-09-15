import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Trash2, Download, Send, Filter, ShieldCheck, Activity, Cpu } from 'lucide-react';
import { CanMessage } from '../../types';
import { transportManager } from '../../services/transportManager';
import { ecuSimulator } from '../../services/ecuSimulator';

interface CanSnifferTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const CanSnifferTab: React.FC<CanSnifferTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [isCapturing, setIsCapturing] = useState<boolean>(true);
  const [filterId, setFilterId] = useState<string>('');
  
  // Custom CAN injection state
  const [customId, setCustomId] = useState<string>('7E0');
  const [customData, setCustomData] = useState<string>('02 10 01 00 00 00 00 00');
  const [isExtended, setIsExtended] = useState<boolean>(false);

  // Subscribe to transport state changes
  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Clear virtual messages when switching to hardware mode
        setMessages([]);
      }
    });
    return unsub;
  }, []);

  // Frame capture loop (Virtual generator OR Real Hardware PassThruReadMsgs)
  useEffect(() => {
    if (!isCapturing) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      if (!isMounted) return;

      const currentMode = transportManager.getState().mode;
      if (currentMode === 'virtual') {
        const newFrames = ecuSimulator.generateCanFrames(Math.floor(Math.random() * 2) + 1);
        setMessages(prev => [...newFrames, ...prev].slice(0, 500));
      } else {
        // Real Hardware Mode: poll actual CAN messages from PassThru hardware buffer
        try {
          const hwFrames = await transportManager.readHardwareCanFrames(5, 40);
          if (hwFrames && hwFrames.length > 0 && isMounted) {
            setMessages(prev => [...hwFrames, ...prev].slice(0, 500));
          }
        } catch {
          // Bus idle
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isCapturing]);

  // Inject frame
  const handleInjectFrame = async () => {
    const cleanId = customId.trim().toUpperCase();
    const cleanData = customData.trim().toUpperCase().split(/\s+/);
    const dlc = cleanData.length;

    const ascii = cleanData.map(b => {
      const code = parseInt(b, 16);
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.';
    }).join('');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    const frame: CanMessage = {
      id: Date.now(),
      timestamp: timeStr,
      canId: cleanId,
      isExtended,
      dlc,
      data: cleanData,
      ascii
    };

    setMessages(prev => [frame, ...prev]);

    const mode = transportManager.getState().mode;
    if (mode === 'virtual') {
      onLog('TX', `${cleanId}#${cleanData.join('')}`, `CAN Frame Injected (ID: 0x${cleanId}, DLC: ${dlc})`);
      // If ID is ECU RX, route to virtual simulator
      if (cleanId === '7E0' || cleanId === '7DF') {
        const simRes = ecuSimulator.processCommand(cleanData.join(' '));
        if (simRes.response) {
          const respBytes = simRes.response.split(' ');
          const respFrame: CanMessage = {
            id: Date.now() + 1,
            timestamp: timeStr,
            canId: '7E8',
            isExtended: false,
            dlc: 8,
            data: respBytes.concat(Array(Math.max(0, 8 - respBytes.length)).fill('00')).slice(0, 8),
            ascii: simRes.response.replace(/\s+/g, '')
          };
          setMessages(prev => [respFrame, ...prev]);
          onLog('RX', `7E8#${respBytes.join('')}`, simRes.decoded);
        }
      }
    } else {
      // In Hardware mode, route purely through transportManager without touching simulator
      const res = await transportManager.sendDiagnosticRequest(cleanData.join(' '), `CAN TX ID: 0x${cleanId}`);
      if (res.rawBytes && res.rawBytes.length > 0) {
        const hexParts = res.rawBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase());
        const respFrame: CanMessage = {
          id: Date.now() + 1,
          timestamp: timeStr,
          canId: transportManager.getState().ecuRx,
          isExtended,
          dlc: Math.min(8, hexParts.length),
          data: hexParts.concat(Array(Math.max(0, 8 - hexParts.length)).fill('00')).slice(0, 8),
          ascii: hexParts.map(h => {
            const c = parseInt(h, 16);
            return c >= 32 && c <= 126 ? String.fromCharCode(c) : '.';
          }).join('')
        };
        setMessages(prev => [respFrame, ...prev]);
      }
    }
  };

  // Export TRC log
  const handleExportTrc = () => {
    if (messages.length === 0) return;
    const header = `;$FILEVERSION=1.1\n;$STARTTIME=0\n;   Msg   Time   Type   ID     Data Bytes\n;--------------------------------------------\n`;
    const lines = messages.map((m, idx) => 
      `${idx.toString().padStart(5, ' ')} ${m.timestamp} DT ${m.canId.padStart(4, ' ')}  ${m.dlc}  ${m.data.join(' ')}`
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAN_Capture_${new Date().toISOString().slice(0, 10)}.trc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredMessages = messages.filter(m => {
    if (!filterId) return true;
    return m.canId.toLowerCase().includes(filterId.toLowerCase()) ||
           m.data.join('').toLowerCase().includes(filterId.toLowerCase());
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
                <strong>REAL HARDWARE CAN SNIFFER ACTIVE</strong> — Listening directly to vehicle CAN bus traffic via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span> (PassThruReadMsgs). Simulated frame generation is stopped.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR CAN SNIFFER</strong> — Streaming simulated periodic powertrain & chassis CAN traffic.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS ACTIVE' : 'BUS STANDBY'}
        </span>
      </div>

      {/* Top Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCapturing(!isCapturing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              isCapturing 
                ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isCapturing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isCapturing ? 'Pause Capture' : 'Resume Capture'}</span>
          </button>

          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Buffer</span>
          </button>

          <button
            onClick={handleExportTrc}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Trace (.TRC)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              placeholder="Filter by ID (e.g. 7E8)..."
              className="bg-slate-950 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono w-48"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredMessages.length} frames
          </span>
        </div>
      </div>

      {/* Frame Injection Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-slate-300">Transmit Raw CAN Frame:</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-mono text-[11px]">ID (Hex):</span>
          <input
            type="text"
            value={customId}
            onChange={(e) => setCustomId(e.target.value.toUpperCase())}
            maxLength={isExtended ? 8 : 3}
            className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-400 font-mono font-bold focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-1 text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isExtended}
            onChange={(e) => setIsExtended(e.target.checked)}
            className="rounded border-slate-700 text-cyan-600 focus:ring-0"
          />
          <span className="text-[11px]">29-bit Ext</span>
        </label>

        <div className="flex items-center gap-1 flex-1 min-w-[240px]">
          <span className="text-slate-400 font-mono text-[11px]">Data Bytes:</span>
          <input
            type="text"
            value={customData}
            onChange={(e) => setCustomData(e.target.value.toUpperCase())}
            placeholder="02 10 01 00 00 00 00 00"
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleInjectFrame}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-3 py-1 rounded transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Frame</span>
        </button>
      </div>

      {/* Frame Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-2 px-3 w-28">Timestamp</th>
                <th className="py-2 px-3 w-20">CAN ID</th>
                <th className="py-2 px-3 w-16">Format</th>
                <th className="py-2 px-3 w-12 text-center">DLC</th>
                <th className="py-2 px-3">Data Bytes (Hex)</th>
                <th className="py-2 px-3 w-28">ASCII</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    {transportState.mode === 'tauri_j2534' ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">Awaiting CAN bus traffic from vehicle</p>
                        <p className="text-xs text-slate-500">PassThru channel is listening. Frames transmitted on physical CAN high/low lines will appear here in real-time.</p>
                      </div>
                    ) : (
                      <p className="text-slate-500">Capture paused or buffer cleared. Click &quot;Resume Capture&quot; to restart.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => {
                  const isEcuTx = msg.canId === '7E8' || msg.canId === '18DAF110';
                  const isTesterTx = msg.canId === '7E0' || msg.canId === '7DF' || msg.canId === '18DA10F1';

                  return (
                    <tr
                      key={msg.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isEcuTx ? 'bg-cyan-950/20 text-cyan-200' : isTesterTx ? 'bg-amber-950/20 text-amber-200' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-1.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">{msg.timestamp}</td>
                      <td className="py-1.5 px-3 font-bold text-white tracking-wide">
                        0x{msg.canId}
                      </td>
                      <td className="py-1.5 px-3 text-[11px] text-slate-400">
                        {msg.isExtended ? '29-bit' : '11-bit'}
                      </td>
                      <td className="py-1.5 px-3 text-center text-slate-400">{msg.dlc}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {msg.data.map((byte, bIdx) => (
                            <span
                              key={bIdx}
                              className={`px-1 py-0.5 rounded text-[11px] ${
                                isEcuTx 
                                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50' 
                                  : isTesterTx
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                  : 'bg-slate-950/60 text-slate-300 border border-slate-800'
                              }`}
                            >
                              {byte}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 text-[11px] tracking-widest whitespace-nowrap">
                        {msg.ascii}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
