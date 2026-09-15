import React, { useState, useRef, useEffect } from 'react';
import { Cpu, Play, Square, Download, FileText, CheckCircle2, Radio } from 'lucide-react';
import { MemoryBlock } from '../../types';
import { transportManager } from '../../services/transportManager';

interface MemoryReadTabProps {
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const MemoryReadTab: React.FC<MemoryReadTabProps> = ({ onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';

  const [startAddress, setStartAddress] = useState<string>('004000');
  const [finishAddress, setFinishAddress] = useState<string>('004200');
  const [blockSize, setBlockSize] = useState<number>(16);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [readProgress, setReadProgress] = useState<number>(0);
  const [memoryBlocks, setMemoryBlocks] = useState<MemoryBlock[]>([]);

  const readTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentAddressRef = useRef<number>(0);
  const endAddressRef = useRef<number>(0);

  // Subscribe to transport state changes
  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        // Clear simulated memory blocks in real hardware mode
        setMemoryBlocks([]);
      } else {
        // Virtual mode: load sample virtual memory dump
        loadVirtualDemoBlocks();
      }
    });

    if (transportManager.getState().mode === 'virtual') {
      loadVirtualDemoBlocks();
    } else {
      setMemoryBlocks([]);
    }

    return unsub;
  }, []);

  const loadVirtualDemoBlocks = () => {
    const initial: MemoryBlock[] = [];
    const base = 0x004000;
    for (let offset = 0; offset < 128; offset += 16) {
      const bytes: string[] = [];
      let ascii = '';
      for (let i = 0; i < 16; i++) {
        const val = ((base + offset + i * 19) ^ 0x4B) & 0xFF;
        bytes.push(val.toString(16).padStart(2, '0').toUpperCase());
        ascii += (val >= 32 && val <= 126) ? String.fromCharCode(val) : '.';
      }
      initial.push({
        address: (base + offset).toString(16).padStart(6, '0').toUpperCase(),
        bytes,
        ascii
      });
    }
    setMemoryBlocks(initial);
  };

  const startMemoryRead = () => {
    const start = parseInt(startAddress.replace(/[^0-9A-Fa-f]/g, ''), 16);
    const finish = parseInt(finishAddress.replace(/[^0-9A-Fa-f]/g, ''), 16);

    if (isNaN(start) || isNaN(finish) || start >= finish) {
      alert('Invalid address range. Start Address must be less than Finish Address.');
      return;
    }

    setIsReading(true);
    setMemoryBlocks([]);
    currentAddressRef.current = start;
    endAddressRef.current = finish;
    setReadProgress(0);

    const totalBytes = finish - start;

    const readNextBlock = async () => {
      const current = currentAddressRef.current;
      const bytesToRead = Math.min(blockSize, endAddressRef.current - current);

      if (bytesToRead <= 0) {
        stopMemoryRead();
        onLog('INFO', `0x23 Memory Read Complete. Read 0x${startAddress} to 0x${finishAddress}`);
        return;
      }

      // Format UDS 0x23 command: 23 [AddressAndLengthFormatIdentifier] [Address] [Length]
      const addrHex = current.toString(16).padStart(6, '0').toUpperCase();
      const lenHex = bytesToRead.toString(16).padStart(2, '0').toUpperCase();
      const cmd = `23 24 ${addrHex} ${lenHex}`;

      const res = await transportManager.sendDiagnosticRequest(cmd, `0x23 ReadMemory @ 0x${addrHex} (Len: ${bytesToRead})`, 1500);
      if (res.status === 'OK') {
        const parts = res.response.split(' ');
        const dataBytes = parts.slice(1);
        const ascii = dataBytes.map(b => {
          const c = parseInt(b, 16);
          return (c >= 32 && c <= 126) ? String.fromCharCode(c) : '.';
        }).join('');

        setMemoryBlocks(prev => [
          ...prev,
          {
            address: addrHex,
            bytes: dataBytes,
            ascii
          }
        ]);
      }

      currentAddressRef.current += bytesToRead;
      const progress = Math.min(100, Math.floor(((currentAddressRef.current - start) / totalBytes) * 100));
      setReadProgress(progress);

      if (currentAddressRef.current >= endAddressRef.current) {
        stopMemoryRead();
        onLog('INFO', `0x23 Direct Memory Read Finished successfully.`);
      }
    };

    readTimerRef.current = setInterval(readNextBlock, 90);
  };

  const stopMemoryRead = () => {
    if (readTimerRef.current) {
      clearInterval(readTimerRef.current);
      readTimerRef.current = null;
    }
    setIsReading(false);
  };

  useEffect(() => {
    return () => {
      if (readTimerRef.current) {
        clearInterval(readTimerRef.current);
      }
    };
  }, []);

  // Export hex dump
  const handleExportHexDump = () => {
    if (memoryBlocks.length === 0) return;
    const lines = memoryBlocks.map(b => `${b.address}  ${b.bytes.join(' ').padEnd(48, ' ')}  |${b.ascii}|`);
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ECU_DMR_Dump_0x${startAddress}_0x${finishAddress}.txt`;
    link.click();
    URL.revokeObjectURL(url);
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
                <strong>REAL HARDWARE MEMORY DUMPER ACTIVE</strong> — Reading physical ECU flash/RAM via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span> (0x23 ReadMemoryByAddress). Simulated memory tables are disabled.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR MEMORY DUMPER</strong> — Simulating ECU flash sector reads (0x004000).
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Service 0x23: Direct Memory Read (DMR)</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">RAM / Flash / EEPROM Dump</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Start Address (Hex):</label>
            <input
              type="text"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value.toUpperCase())}
              disabled={isReading}
              placeholder="004000"
              maxLength={8}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-cyan-300 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Finish Address (Hex):</label>
            <input
              type="text"
              value={finishAddress}
              onChange={(e) => setFinishAddress(e.target.value.toUpperCase())}
              disabled={isReading}
              placeholder="004400"
              maxLength={8}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-cyan-300 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Block Size (Bytes):</label>
            <select
              value={blockSize}
              onChange={(e) => setBlockSize(Number(e.target.value))}
              disabled={isReading}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
            >
              <option value={16}>16 Bytes (0x10)</option>
              <option value={32}>32 Bytes (0x20)</option>
              <option value={64}>64 Bytes (0x40)</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            {!isReading ? (
              <button
                onClick={startMemoryRead}
                className="w-full flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Read (0x23)</span>
              </button>
            ) : (
              <button
                onClick={stopMemoryRead}
                className="w-full flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isReading && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Memory Read Progress:</span>
              <span className="font-mono text-cyan-300 font-bold">{readProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-cyan-500 h-full transition-all duration-150"
                style={{ width: `${readProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hex Dump Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col">
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-mono">
            Hex Dump Output ({memoryBlocks.length * 16} Bytes Loaded)
          </h3>

          <button
            onClick={handleExportHexDump}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save Hex Dump</span>
          </button>
        </div>

        <div className="p-3 bg-slate-950 font-mono text-xs overflow-x-auto max-h-[500px]">
          {/* Header Row */}
          <div className="text-slate-500 border-b border-slate-800 pb-1 mb-1 flex select-none text-[11px]">
            <span className="w-20">Offset</span>
            <span className="flex-1 tracking-wider">
              00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
            </span>
            <span className="w-40 text-right">ASCII Decoded</span>
          </div>

          {memoryBlocks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-sans">
              {transportState.mode === 'tauri_j2534' ? (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-300">No ECU memory dump loaded</p>
                  <p className="text-xs text-slate-500">Configure start and finish address above, then click &quot;Start Memory Read&quot; to dump live memory bytes via UDS 0x23.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-300">Virtual memory table empty</p>
                  <p className="text-xs text-slate-500">Click &quot;Start Memory Read&quot; to read virtual memory addresses.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {memoryBlocks.map((block, idx) => {
                const b = block.bytes;
                const col1 = b.slice(0, 8).join(' ');
                const col2 = b.slice(8, 16).join(' ');

                return (
                  <div key={idx} className="flex hover:bg-slate-900/80 px-1 py-0.5 rounded leading-none">
                    <span className="w-20 text-cyan-400 select-none font-bold">
                      {block.address}
                    </span>
                    <span className="flex-1 text-slate-300 tracking-wider">
                      {col1}&nbsp;&nbsp;{col2}
                    </span>
                    <span className="w-40 text-right text-emerald-400 tracking-widest">
                      {block.ascii}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
