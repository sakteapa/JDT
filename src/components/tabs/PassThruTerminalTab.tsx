import React, { useState, useEffect } from 'react';
import { Terminal, Send, Trash2, Download, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownLeft, Radio, Cpu } from 'lucide-react';
import { PassThruLogEntry } from '../../types';
import { transportManager } from '../../services/transportManager';

interface PassThruTerminalTabProps {
  logs: PassThruLogEntry[];
  onClearLogs: () => void;
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const PassThruTerminalTab: React.FC<PassThruTerminalTabProps> = ({ logs, onClearLogs, onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const [commandInput, setCommandInput] = useState<string>('22 F1 90');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
    });
    return unsub;
  }, []);

  const handleSendCommand = async (cmdToSend?: string) => {
    const raw = (cmdToSend || commandInput).trim().toUpperCase();
    if (!raw) return;

    await transportManager.sendDiagnosticRequest(raw, 'PassThru Manual Command');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    }
  };

  // Export log file
  const handleExportLog = () => {
    if (logs.length === 0) return;
    const lines = logs.map(l => `[${l.timestamp}] [${l.direction}] ${l.raw}${l.decoded ? '  // ' + l.decoded : ''}`);
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PassThru_Log_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-170px)]">
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
                <strong>REAL HARDWARE PASSTHRU TERMINAL</strong> — Raw diagnostic commands are written to hardware channel via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR TERMINAL</strong> — Terminal connected to local ISO 14229 / ISO 15765 virtual ECU.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Quick Macro Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 text-[11px] font-medium mr-1 select-none">Quick Commands:</span>
        {[
          { label: '02 10 01 (Default)', cmd: '02 10 01' },
          { label: '02 10 03 (Extended)', cmd: '02 10 03' },
          { label: '02 10 02 (Programming)', cmd: '02 10 02' },
          { label: '03 22 F1 90 (Read VIN)', cmd: '03 22 F1 90' },
          { label: '03 22 F1 88 (Calibration)', cmd: '03 22 F1 88' },
          { label: '02 27 01 (Request Seed)', cmd: '02 27 01' },
          { label: '02 3E 00 (Tester Present)', cmd: '02 3E 00' },
          { label: '04 14 FF FF FF (Clear DTCs)', cmd: '04 14 FF FF FF' }
        ].map(item => (
          <button
            key={item.cmd}
            onClick={() => {
              setCommandInput(item.cmd);
              handleSendCommand(item.cmd);
            }}
            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Display Screen */}
      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-inner">
        {/* Terminal Header */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>PassThru Communication Stream</span>
            <span className="text-slate-500">({logs.length} events)</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-[11px]">Auto-scroll</span>
            </label>

            <button
              onClick={onClearLogs}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={handleExportLog}
              className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Terminal Log Items */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1 select-text">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-600 font-sans text-xs">
              Terminal log is empty. Send a command or select a service to view live communications.
            </div>
          ) : (
            logs.map((log) => {
              const isTx = log.direction === 'TX';
              const isRx = log.direction === 'RX';
              const isErr = log.direction === 'ERR';

              return (
                <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/50 px-1.5 py-0.5 rounded leading-relaxed">
                  <span className="text-slate-500 text-[11px] select-none shrink-0 w-20">
                    {log.timestamp}
                  </span>

                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold select-none shrink-0 ${
                    isTx 
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' 
                      : isRx 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                      : isErr 
                      ? 'bg-rose-950 text-rose-400 border border-rose-800' 
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {log.direction}
                  </span>

                  <span className="text-white font-bold tracking-wider shrink-0">
                    {log.raw}
                  </span>

                  {log.decoded && (
                    <span className="text-slate-400 text-[11px] truncate">
                      // {log.decoded}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter Raw Hex Bytes (e.g. 22 F1 90)..."
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-cyan-300 font-mono font-bold text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => handleSendCommand()}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-4 rounded transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send (TX)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
