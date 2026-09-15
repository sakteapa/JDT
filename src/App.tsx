import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  KeyRound, 
  AlertTriangle, 
  Database, 
  Activity, 
  Radio, 
  Cpu, 
  Car, 
  Network, 
  Terminal as TerminalIcon 
} from 'lucide-react';

import { 
  J2534Device, 
  CanBusType, 
  DiagnosticProtocol, 
  PassThruLogEntry, 
  ActiveTab,
  VirtualEcuState 
} from './types';
import { ecuSimulator } from './services/ecuSimulator';
import { transportManager, TransportType, TransportState } from './services/transportManager';

import { Header } from './components/Header';
import { ServicesTab } from './components/tabs/ServicesTab';
import { SecurityAccessTab } from './components/tabs/SecurityAccessTab';
import { DtcTab } from './components/tabs/DtcTab';
import { DidTab } from './components/tabs/DidTab';
import { ObdTab } from './components/tabs/ObdTab';
import { CanSnifferTab } from './components/tabs/CanSnifferTab';
import { MemoryReadTab } from './components/tabs/MemoryReadTab';
import { VinDecoderTab } from './components/tabs/VinDecoderTab';
import { BusSnifferTab } from './components/tabs/BusSnifferTab';
import { PassThruTerminalTab } from './components/tabs/PassThruTerminalTab';

import { Hex2DecModal } from './components/modals/Hex2DecModal';
import { AboutModal } from './components/modals/AboutModal';

export default function App() {
  // Connection and Hardware Configuration State
  const [device, setDevice] = useState<J2534Device>('Virtual ECU Simulator (CAN & UDS)');
  const [busType, setBusType] = useState<CanBusType>('High Speed CAN (500k)');
  const [protocol, setProtocol] = useState<DiagnosticProtocol>('ISO 15765-4 CAN (11-Bit 500K)');
  const [ecuRx, setEcuRx] = useState<string>('7E0');
  const [ecuTx, setEcuTx] = useState<string>('7E8');
  const [is29Bit, setIs29Bit] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);

  // Transport State listener
  const [transportState, setTransportState] = useState<TransportState>(transportManager.getState());

  useEffect(() => {
    const unsubState = transportManager.subscribeState((s) => {
      setTransportState(s);
      setConnected(s.connected);
    });

    const unsubLogs = transportManager.subscribeLog((direction, raw, decoded) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      setLogs(prev => [
        ...prev,
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          timestamp: timeStr,
          direction,
          raw,
          decoded
        }
      ]);
    });

    return () => {
      unsubState();
      unsubLogs();
    };
  }, []);

  // Simulator State listener
  const [ecuState, setEcuState] = useState<VirtualEcuState>(ecuSimulator.getState());

  useEffect(() => {
    const unsub = ecuSimulator.subscribe((newState) => {
      setEcuState(newState);
    });
    return unsub;
  }, []);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('services');

  // Logs stream
  const [logs, setLogs] = useState<PassThruLogEntry[]>([
    {
      id: 1,
      timestamp: '00:00:01.102',
      direction: 'INFO',
      raw: 'PassThruOpen("Virtual ECU Simulator", &DeviceID) = STATUS_SUCCESS',
      decoded: 'Hardware device initialized'
    },
    {
      id: 2,
      timestamp: '00:00:01.145',
      direction: 'INFO',
      raw: 'PassThruConnect(DeviceID, ISO15765, 500000, &ChannelID) = STATUS_SUCCESS',
      decoded: 'CAN channel established at 500 kbps (11-bit ID)'
    },
    {
      id: 3,
      timestamp: '00:00:01.210',
      direction: 'TX',
      raw: '02 10 01',
      decoded: 'DiagnosticSessionControl: DefaultSession (0x01)'
    },
    {
      id: 4,
      timestamp: '00:00:01.228',
      direction: 'RX',
      raw: '02 50 01',
      decoded: 'PositiveResponse: DefaultSession Active'
    }
  ]);

  // Modals state
  const [isHexModalOpen, setIsHexModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // Add Log Entry Helper
  const handleAddLog = (direction: 'TX' | 'RX' | 'INFO' | 'ERR', raw: string, decoded?: string) => {
    transportManager.notifyLog(direction, raw, decoded);
  };

  const handleDeviceChange = (newDevice: J2534Device) => {
    setDevice(newDevice);
    transportManager.setDevice(newDevice);
  };

  const handleSetTransportMode = (mode: TransportType) => {
    transportManager.setTransportMode(mode);
  };

  const handleConnectToggle = async () => {
    if (connected) {
      await transportManager.passThruDisconnect();
    } else {
      await transportManager.passThruOpen(device);
      await transportManager.passThruConnect(busType, protocol, ecuRx, ecuTx, is29Bit);
    }
  };

  const handleToggleTesterPresent = async () => {
    await transportManager.toggleTesterPresent();
  };

  // Switch ECU Target from Bus Sniffer
  const handleSelectEcu = (newRx: string, newTx: string) => {
    setEcuRx(newRx);
    setEcuTx(newTx);
    setActiveTab('services');
  };

  // Tab definitions
  const tabs = [
    { id: 'services' as ActiveTab, label: 'Services (UDS)', icon: Wrench },
    { id: 'security' as ActiveTab, label: 'Security Access', icon: KeyRound },
    { id: 'dtc' as ActiveTab, label: 'DTCs (Faults)', icon: AlertTriangle },
    { id: 'did' as ActiveTab, label: 'DIDs (0x22)', icon: Database },
    { id: 'obd' as ActiveTab, label: 'OBD-II Live', icon: Activity },
    { id: 'can' as ActiveTab, label: 'CAN Sniffer', icon: Radio },
    { id: 'memory' as ActiveTab, label: 'Direct Memory (0x23)', icon: Cpu },
    { id: 'vin' as ActiveTab, label: 'VIN Decoder', icon: Car },
    { id: 'bus' as ActiveTab, label: 'BUS Sniffer', icon: Network },
    { id: 'terminal' as ActiveTab, label: 'PassThru Terminal', icon: TerminalIcon }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Main Hardware & Protocol Toolbar */}
      <Header
        device={device}
        setDevice={handleDeviceChange}
        busType={busType}
        setBusType={setBusType}
        protocol={protocol}
        setProtocol={setProtocol}
        ecuRx={ecuRx}
        setEcuRx={setEcuRx}
        ecuTx={ecuTx}
        setEcuTx={setEcuTx}
        is29Bit={is29Bit}
        setIs29Bit={setIs29Bit}
        connected={connected}
        onToggleConnect={handleConnectToggle}
        sessionName={ecuState.session}
        isUnlocked={ecuState.securityUnlocked}
        testerPresent={ecuState.testerPresentActive}
        onToggleTesterPresent={handleToggleTesterPresent}
        onOpenHex2Dec={() => setIsHexModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        transportMode={transportState.mode}
        onSetTransportMode={handleSetTransportMode}
        vBat={transportState.vBat}
      />

      {/* Main Tab Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto no-scrollbar gap-1 py-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-950 text-cyan-400 border border-slate-800 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'services' && <ServicesTab onLog={handleAddLog} />}
        {activeTab === 'security' && <SecurityAccessTab onLog={handleAddLog} />}
        {activeTab === 'dtc' && <DtcTab onLog={handleAddLog} />}
        {activeTab === 'did' && <DidTab onLog={handleAddLog} />}
        {activeTab === 'obd' && <ObdTab onLog={handleAddLog} />}
        {activeTab === 'can' && <CanSnifferTab onLog={handleAddLog} />}
        {activeTab === 'memory' && <MemoryReadTab onLog={handleAddLog} />}
        {activeTab === 'vin' && <VinDecoderTab onLog={handleAddLog} />}
        {activeTab === 'bus' && <BusSnifferTab onSelectEcu={handleSelectEcu} onLog={handleAddLog} />}
        {activeTab === 'terminal' && (
          <PassThruTerminalTab
            logs={logs}
            onClearLogs={() => setLogs([])}
            onLog={handleAddLog}
          />
        )}
      </main>

      {/* Modals */}
      <Hex2DecModal
        isOpen={isHexModalOpen}
        onClose={() => setIsHexModalOpen(false)}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
}
