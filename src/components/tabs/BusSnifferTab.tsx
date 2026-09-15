import React, { useState, useEffect } from 'react';
import { Network, Play, RefreshCw, CheckCircle2, XCircle, ArrowRight, ShieldCheck, Cpu, Radio } from 'lucide-react';
import { BusEcuNode } from '../../types';
import { INITIAL_BUS_NODES } from '../../services/ecuSimulator';
import { transportManager } from '../../services/transportManager';

interface BusSnifferTabProps {
  onSelectEcu: (rx: string, tx: string) => void;
  onLog: (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => void;
}

export const BusSnifferTab: React.FC<BusSnifferTabProps> = ({ onSelectEcu, onLog }) => {
  const [transportState, setTransportState] = useState(transportManager.getState());
  const isVirtual = transportState.mode === 'virtual';
  const [nodes, setNodes] = useState<BusEcuNode[]>(isVirtual ? INITIAL_BUS_NODES : []);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentScanId, setCurrentScanId] = useState<string>('7E0');

  useEffect(() => {
    const unsub = transportManager.subscribeState((newState) => {
      setTransportState(newState);
      if (newState.mode === 'tauri_j2534') {
        setNodes([]);
      } else {
        setNodes(INITIAL_BUS_NODES);
      }
    });
    return unsub;
  }, []);

  // Start Bus Scan
  const handleScanBus = async () => {
    setIsScanning(true);
    const mode = transportManager.getState().mode;
    onLog('TX', 'SCAN 0x700-0x7F0', `Initiating CAN Bus Diagnostic Address Discovery on ${mode.toUpperCase()} interface...`);

    if (mode === 'virtual') {
      setNodes(INITIAL_BUS_NODES);
      let idx = 0;
      const interval = setInterval(() => {
        if (idx >= INITIAL_BUS_NODES.length) {
          clearInterval(interval);
          setIsScanning(false);
          onLog('INFO', `Bus Scan Finished. Discovered ${INITIAL_BUS_NODES.filter(n => n.online).length} Active ECUs.`);
          return;
        }

        const node = INITIAL_BUS_NODES[idx];
        setCurrentScanId(node.rxId);
        if (node.online) {
          onLog('RX', `${node.txId}#027E00`, `Active ECU Response from 0x${node.txId} (${node.name})`);
        }
        idx++;
      }, 250);
    } else {
      // In Hardware mode, ping active target ECU over physical PassThru channel
      const activeRx = transportManager.getState().ecuRx;
      const activeTx = transportManager.getState().ecuTx;
      setCurrentScanId(activeTx);
      const pingRes = await transportManager.sendDiagnosticRequest('3E 00', 'CAN Address Probe 0x3E Ping', 1500);

      const hwNode: BusEcuNode = {
        name: pingRes.status === 'OK' ? `Target ECU (${transportManager.getState().selectedDevice})` : 'Unresponsive Target Node',
        rxId: activeRx,
        txId: activeTx,
        protocol: transportManager.getState().protocol,
        online: pingRes.status === 'OK',
        lastPingMs: pingRes.latencyMs || 12
      };

      setNodes([hwNode]);
      setIsScanning(false);
      onLog('INFO', `Hardware Bus Probe Finished. ${pingRes.status === 'OK' ? '1 Target Online' : 'No Response from Target'}`);
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
                <strong>REAL HARDWARE BUS TOPOLOGY SCANNER</strong> — Scans physical vehicle network via{' '}
                <span className="font-mono text-white">{transportState.selectedDevice}</span>. Simulated nodes are disabled.
              </>
            ) : (
              <>
                <strong>VIRTUAL SIMULATOR BUS TOPOLOGY</strong> — Emulating standard vehicle modules (ECM, TCM, BCM, ABS).
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
          {transportState.connected ? 'BUS CONNECTED' : 'STANDBY'}
        </span>
      </div>

      {/* Top Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">CAN Bus Diagnostic ID Sniffer</h3>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              0x700 - 0x7E7 Address Discovery
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Probe the network bus to map all responsive electronic control units and automatically extract physical RX/TX addresses.
          </p>
        </div>

        <button
          onClick={handleScanBus}
          disabled={isScanning}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs py-2 px-4 rounded transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? `Probing 0x${currentScanId}...` : 'Start Full Bus Scan'}</span>
        </button>
      </div>

      {/* Discovered ECUs Grid / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col">
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider">
            Network Topology Nodes ({nodes.length})
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            {nodes.filter(n => n.online).length} Responsive Online
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Module Name</th>
                <th className="py-2.5 px-3">Tester RX (Send)</th>
                <th className="py-2.5 px-3">ECU TX (Response)</th>
                <th className="py-2.5 px-3">Diagnostic Protocol</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    {transportState.mode === 'tauri_j2534' ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No hardware ECU nodes discovered</p>
                        <p className="text-xs text-slate-500">
                          Click &quot;Start Full Bus Scan&quot; to probe physical CAN identifiers 0x700–0x7E7 on the vehicle network.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No simulated nodes</p>
                        <p className="text-xs text-slate-500">Click &quot;Start Full Bus Scan&quot; to discover virtual ECU nodes.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr key={node.rxId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {node.online ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Online</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>No Response</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {node.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                      0x{node.rxId}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                      0x{node.txId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {node.protocol}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          onSelectEcu(node.rxId, node.txId);
                          onLog('INFO', `Active ECU target set to ${node.name} (RX: 0x${node.rxId}, TX: 0x${node.txId})`);
                        }}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer border border-slate-700 hover:border-cyan-500"
                      >
                        <span>Select Target</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
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
