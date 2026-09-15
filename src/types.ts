export type J2534Device = 
  | 'Zenith Z5 PassThru'
  | 'Generic SAE J2534 (passthru32.dll)'
  | 'Tactrix Openport 2.0'
  | 'Scanmatik 2 Pro'
  | 'Mongoose Pro'
  | 'Ford VCM2'
  | 'OBDXPro FT'
  | 'Kvaser Leaf Light'
  | 'WebSerial / WebUSB PassThru'
  | 'Virtual ECU Simulator (CAN & UDS)'
  | (string & {});

export interface J2534DeviceInfo {
  id: string;
  name: J2534Device;
  vendor: string;
  dllPath: string;
  registryPath?: string;
  configApplication?: string;
  isRealHardware: boolean;
  canSupported: boolean;
  iso15765Supported: boolean;
  kwpSupported: boolean;
  dualWireCan: boolean;
  status: 'Ready' | 'Disconnected' | 'Simulated';
  isRegistryDetected?: boolean;
  isConnected?: boolean;
  connectionStatus?: 'Connected & Ready' | 'Not Connected / Offline' | 'Simulated' | 'Probing...';
  displayName?: string;
  probeError?: string;
  lastChecked?: string;
}

export type CanBusType = 'High Speed CAN (500k)' | 'Medium Speed CAN (125k)' | 'Medium Speed CAN (250k)' | 'K-Line (ISO 9141 / 14230)';

export type DiagnosticProtocol = 
  | 'ISO 15765-4 CAN (11-Bit 500K)'
  | 'ISO 15765-4 CAN (29-Bit 500K)'
  | 'ISO 14230-4 KWP2000'
  | 'ISO 9141-2 K-Line';

export type DiagnosticSessionType = 
  | '01 Default'
  | '02 Programming'
  | '03 Extended Diagnostic'
  | '04 Safety System'
  | '81 KWP Default'
  | '85 KWP ECU Programming'
  | '87 KWP ECU Adjustment';

export interface CanMessage {
  id: number;
  timestamp: string;
  canId: string;
  isExtended: boolean;
  dlc: number;
  data: string[];
  ascii: string;
}

export interface DtcRecord {
  id: string;
  code: string;
  global: 'Global' | 'Manufacturer';
  type: 'Powertrain (P)' | 'Chassis (C)' | 'Body (B)' | 'Network (U)';
  subType: string;
  definition: string;
  statusByte?: string;
  statusFlags?: {
    testFailed?: boolean;
    testFailedThisCycle?: boolean;
    pendingDTC?: boolean;
    confirmedDTC?: boolean;
    testNotCompletedSinceClear?: boolean;
    warningIndicatorRequested?: boolean;
  };
}

export interface DidRecord {
  did: string;
  definition: string;
  data?: string;
  ascii?: string;
  status: 'FOUND' | 'NRC_7F' | 'PENDING';
}

export interface MemoryBlock {
  address: string;
  bytes: string[];
  ascii: string;
}

export interface BusEcuNode {
  rxId: string;
  txId: string;
  name: string;
  online: boolean;
  protocol: string;
  lastPingMs?: number;
}

export type VirtualEcuState = {
  connected: boolean;
  busType: string;
  protocol: string;
  ecuRx: string;
  ecuTx: string;
  is29Bit: boolean;
  session: string;
  securityLevel: number;
  securityUnlocked: boolean;
  currentSeed: string;
  testerPresentActive: boolean;
  dtcsSuppressed: boolean;
  dtcList: DtcRecord[];
  memoryDumpSize: number;
};

export type ActiveTab = 
  | 'services'
  | 'security'
  | 'dtc'
  | 'did'
  | 'obd'
  | 'can'
  | 'memory'
  | 'vin'
  | 'bus'
  | 'terminal';

export interface PassThruLogEntry {
  id: string | number;
  timestamp: string;
  direction: 'TX' | 'RX' | 'INFO' | 'ERR';
  raw: string;
  decoded?: string;
}

export interface ObdPidData {
  pid: string;
  name: string;
  value: number | string;
  unit: string;
  min?: number;
  max?: number;
}
