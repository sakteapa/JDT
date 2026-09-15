import { CanMessage, DtcRecord, DidRecord, BusEcuNode, PassThruLogEntry, ObdPidData } from '../types';
import { parseDtcFromBytes, COMMON_DTC_LIST } from '../data/dtcDatabase';
import { lookupDid } from '../data/didDatabase';
import { computeSecurityKey, cleanHex, hexToBytes, bytesToHex } from './securityAlgorithms';

export interface SimulatorState {
  connected: boolean;
  busType: string;
  protocol: string;
  ecuRx: string; // e.g. 7E0
  ecuTx: string; // e.g. 7E8
  is29Bit: boolean;
  session: string; // 'Default', 'Programming', 'Extended'
  securityLevel: number;
  securityUnlocked: boolean;
  currentSeed: string;
  testerPresentActive: boolean;
  dtcsSuppressed: boolean;
  dtcList: DtcRecord[];
  memoryDumpSize: number;
}

export const INITIAL_DTCS: DtcRecord[] = [
  parseDtcFromBytes(0x03, 0x00, 0x14, 0x2F), // P0300-14 Random Misfire
  parseDtcFromBytes(0x01, 0x71, 0x00, 0x2E), // P0171-00 System Too Lean Bank 1
  parseDtcFromBytes(0x40, 0x31, 0x11, 0x27), // C0031-11 Left Front Wheel Speed Sensor
  parseDtcFromBytes(0x80, 0x01, 0x13, 0x28), // B0001-13 Driver Airbag Stage 1
  parseDtcFromBytes(0xC1, 0x00, 0x87, 0x2B), // U0100-87 Lost Comm with ECM/PCM
  parseDtcFromBytes(0x04, 0x20, 0x00, 0x2F)  // P0420-00 Catalyst System Below Threshold
];

export const INITIAL_BUS_NODES: BusEcuNode[] = [
  { rxId: '7E0', txId: '7E8', name: 'Powertrain Control Module (PCM / ECM)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '7E1', txId: '7E9', name: 'Transmission Control Module (TCM)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '720', txId: '728', name: 'Instrument Panel Cluster (IPC)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '760', txId: '768', name: 'Anti-Lock Brake / Stability (ABS/ESP)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '726', txId: '72E', name: 'Body Control Module (BCM)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '733', txId: '73B', name: 'Heating & Air Conditioning (HVAC)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '737', txId: '73F', name: 'Restraints Control Module (RCM / Airbag)', online: true, protocol: 'ISO 15765-4 (UDS)' },
  { rxId: '7D0', txId: '7D8', name: 'Accessory Protocol Interface (APIM / Infotainment)', online: false, protocol: 'ISO 15765-4 (UDS)' }
];

export class VirtualEcuEngine {
  private state: SimulatorState = {
    connected: false,
    busType: 'High Speed CAN (500k)',
    protocol: 'ISO 15765-4 CAN (11-Bit 500K)',
    ecuRx: '7E0',
    ecuTx: '7E8',
    is29Bit: false,
    session: 'Default',
    securityLevel: 0,
    securityUnlocked: false,
    currentSeed: '4A 9B C3 12',
    testerPresentActive: false,
    dtcsSuppressed: false,
    dtcList: [...INITIAL_DTCS],
    memoryDumpSize: 1024
  };

  private vin = '1FTFW1ED4MFA12984';
  private calibrationId = 'FL3A-14C204-BLH';
  private softwareVersion = 'v14.02.09-PROD';
  private listeners: Array<(state: SimulatorState) => void> = [];

  public subscribe(listener: (state: SimulatorState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach(l => l(s));
  }

  public getState(): SimulatorState {
    return { ...this.state, dtcList: [...this.state.dtcList] };
  }

  public connect(device: string, bus: string, protocol: string, rx: string, tx: string, is29Bit: boolean): boolean {
    this.state.connected = true;
    this.state.busType = bus;
    this.state.protocol = protocol;
    this.state.ecuRx = rx.toUpperCase();
    this.state.ecuTx = tx.toUpperCase();
    this.state.is29Bit = is29Bit;
    this.notify();
    return true;
  }

  public disconnect(): void {
    this.state.connected = false;
    this.state.testerPresentActive = false;
    this.state.session = 'Default';
    this.state.securityUnlocked = false;
    this.notify();
  }

  public setTesterPresent(active: boolean): void {
    this.state.testerPresentActive = active;
    this.notify();
  }

  public toggleTesterPresent(): boolean {
    this.state.testerPresentActive = !this.state.testerPresentActive;
    this.notify();
    return this.state.testerPresentActive;
  }

  public clearDtcs(): void {
    this.state.dtcList = [];
    this.notify();
  }

  public addTestDtc(dtc: DtcRecord): void {
    this.state.dtcList.unshift(dtc);
    this.notify();
  }

  public generateRandomSeed(): string {
    const bytes = [
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256)
    ];
    this.state.currentSeed = bytesToHex(bytes);
    return this.state.currentSeed;
  }

  // Diagnostic Service execution engine
  public processCommand(rawInput: string): { response: string; decoded: string; status: 'OK' | 'NRC' } {
    const cleaned = cleanHex(rawInput);
    if (!cleaned || cleaned.length < 2) {
      return { response: '7F 00 13', decoded: 'Negative Response 0x7F: [0x13] Incorrect Message Length', status: 'NRC' };
    }

    const bytes = hexToBytes(cleaned);
    let sid = bytes[0];
    let sub = bytes[1];

    // Check if user included ISO-TP single-frame length byte prefix (e.g. 02 10 01)
    if (bytes.length > 2 && bytes[0] < 8 && bytes.length === bytes[0] + 1) {
      sid = bytes[1];
      sub = bytes[2];
    }

    // 0x10 DiagnosticSessionControl
    if (sid === 0x10) {
      const sessionMap: Record<number, string> = {
        0x01: 'Default Session (0x01)',
        0x02: 'Programming Session (0x02)',
        0x03: 'Extended Diagnostic Session (0x03)',
        0x04: 'Safety System Diagnostic Session (0x04)',
        0x81: 'KWP2000 Default Session ($81)',
        0x85: 'KWP2000 Programming Mode ($85)',
        0x87: 'KWP2000 ECU Adjustment ($87)'
      };
      const sessionName = sessionMap[sub] || `Custom Session (0x${sub.toString(16).toUpperCase()})`;
      this.state.session = sessionName;
      // Positive response: 0x50 + sub-function + P2/P2* timing params (e.g. 00 32 01 F4 = P2 50ms, P2* 5000ms)
      const resp = `50 ${sub.toString(16).padStart(2, '0').toUpperCase()} 00 32 01 F4`;
      return {
        response: resp,
        decoded: `Positive Response 0x50: Transitioned to ${sessionName}. P2_max=50ms, P2*_max=5000ms`,
        status: 'OK'
      };
    }

    // 0x11 ECUReset
    if (sid === 0x11) {
      const resetMap: Record<number, string> = {
        0x01: 'Hard Reset (0x01)',
        0x02: 'Key Off On Reset (0x02)',
        0x03: 'Soft Reset (0x03)',
        0x04: 'Enable Rapid Power Shutdown (0x04)'
      };
      const resetType = resetMap[sub] || 'Reset';
      this.state.session = 'Default';
      this.state.securityUnlocked = false;
      return {
        response: `51 ${sub.toString(16).padStart(2, '0').toUpperCase()}`,
        decoded: `Positive Response 0x51: ${resetType} initiated. Active session reset to Default.`,
        status: 'OK'
      };
    }

    // 0x14 ClearDiagnosticInformation
    if (sid === 0x14) {
      this.clearDtcs();
      return {
        response: '54',
        decoded: 'Positive Response 0x54: All Diagnostic Trouble Codes & Freeze Frame Data Cleared.',
        status: 'OK'
      };
    }

    // 0x18 / 0x19 ReadDTCInformation
    if (sid === 0x18 || sid === 0x19) {
      if (this.state.dtcList.length === 0) {
        return {
          response: `${(sid + 0x40).toString(16).toUpperCase()} 02 00`,
          decoded: 'Positive Response: DTC Status Availability Mask 0xFF. 0 Trouble Codes Stored.',
          status: 'OK'
        };
      }
      // Return list of DTCs
      let respHex = `${(sid + 0x40).toString(16).toUpperCase()} 02 FF`;
      for (const dtc of this.state.dtcList) {
        const parts = dtc.code.split('-');
        const base = parts[0];
        const subCode = parts[1] || '00';
        
        let typeVal = 0;
        if (base.startsWith('C')) typeVal = 1;
        if (base.startsWith('B')) typeVal = 2;
        if (base.startsWith('U')) typeVal = 3;

        const d2 = parseInt(base.charAt(1), 10) || 0;
        const b1 = (typeVal << 6) | (d2 << 4) | (parseInt(base.charAt(2), 16) || 0);
        const b2 = parseInt(base.substring(3, 5), 16) || 0;
        const b3 = parseInt(subCode, 16) || 0;
        const status = parseInt(dtc.statusByte?.replace('0x', '') || '2F', 16);

        respHex += ` ${b1.toString(16).padStart(2, '0').toUpperCase()} ${b2.toString(16).padStart(2, '0').toUpperCase()} ${b3.toString(16).padStart(2, '0').toUpperCase()} ${status.toString(16).padStart(2, '0').toUpperCase()}`;
      }
      return {
        response: respHex,
        decoded: `Positive Response: Returned ${this.state.dtcList.length} Diagnostic Trouble Code(s).`,
        status: 'OK'
      };
    }

    // 0x22 ReadDataByIdentifier (DID)
    if (sid === 0x22) {
      const didHigh = bytes[1];
      const didLow = bytes[2];
      const didHex = `${didHigh.toString(16).padStart(2, '0')}${didLow.toString(16).padStart(2, '0')}`.toUpperCase();
      const didDef = lookupDid(didHex);

      if (didHex === 'F190') {
        // Return VIN
        const asciiBytes = this.vin.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return {
          response: `62 F1 90 ${asciiBytes}`,
          decoded: `Positive Response 0x62 DID 0xF190 (VIN): "${this.vin}"`,
          status: 'OK'
        };
      }
      if (didHex === 'F188') {
        const asciiBytes = this.calibrationId.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return {
          response: `62 F1 88 ${asciiBytes}`,
          decoded: `Positive Response 0x62 DID 0xF188 (ECU Calibration): "${this.calibrationId}"`,
          status: 'OK'
        };
      }
      if (didHex === 'F100' || didHex === 'F109') {
        const asciiBytes = this.softwareVersion.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return {
          response: `62 ${didHex.substring(0, 2)} ${didHex.substring(2, 4)} ${asciiBytes}`,
          decoded: `Positive Response 0x62 DID 0x${didHex} (Software Version): "${this.softwareVersion}"`,
          status: 'OK'
        };
      }
      if (didHex.startsWith('01') || didHex.startsWith('F1') || didHex.startsWith('F8')) {
        // Return simulated telemetry bytes
        const simulatedData = [0x01, 0x4A, 0x88, 0x00].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return {
          response: `62 ${didHex.substring(0, 2)} ${didHex.substring(2, 4)} ${simulatedData}`,
          decoded: `Positive Response 0x62 DID 0x${didHex} (${didDef.name}): [${simulatedData}]`,
          status: 'OK'
        };
      }

      return {
        response: `7F 22 31`,
        decoded: `Negative Response 0x7F 22 [0x31]: Request Out Of Range (DID 0x${didHex} not supported on target)`,
        status: 'NRC'
      };
    }

    // 0x23 ReadMemoryByAddress (DMR)
    if (sid === 0x23) {
      const startAddr = (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
      const length = bytes[5] || 0x20;
      const memBytes: number[] = [];
      for (let i = 0; i < Math.min(length, 64); i++) {
        // Seeded pseudo memory byte
        const val = ((startAddr + i * 37) ^ 0x5C) & 0xFF;
        memBytes.push(val);
      }
      const dataHex = bytesToHex(memBytes);
      return {
        response: `63 ${dataHex}`,
        decoded: `Positive Response 0x63: Read ${memBytes.length} bytes from 0x${startAddr.toString(16).toUpperCase()}`,
        status: 'OK'
      };
    }

    // 0x27 SecurityAccess
    if (sid === 0x27) {
      const level = sub;
      // Request Seed: Odd numbers (0x01, 0x03, 0x05, 0x09, 0x11, 0x61)
      if (level % 2 === 1) {
        this.generateRandomSeed();
        this.state.securityLevel = level;
        return {
          response: `67 ${level.toString(16).padStart(2, '0').toUpperCase()} ${this.state.currentSeed}`,
          decoded: `Positive Response 0x67: Seed generated for Security Level 0x${level.toString(16).padStart(2, '0').toUpperCase()}: [${this.state.currentSeed}]`,
          status: 'OK'
        };
      }
      // Send Key: Even numbers (0x02, 0x04, etc.)
      const keyBytes = bytes.slice(2);
      if (keyBytes.length === 0) {
        return {
          response: '7F 27 13',
          decoded: 'Negative Response 0x7F 27 [0x13]: Incorrect Message Length (Key missing)',
          status: 'NRC'
        };
      }
      // In simulator, if a key is provided or bruteforced, acknowledge
      this.state.securityUnlocked = true;
      return {
        response: `67 ${level.toString(16).padStart(2, '0').toUpperCase()}`,
        decoded: `Positive Response 0x67: Security Access GRANTED (Level 0x${(level - 1).toString(16).padStart(2, '0').toUpperCase()}). ECU Unlocked!`,
        status: 'OK'
      };
    }

    // 0x2E WriteDataByIdentifier
    if (sid === 0x2E) {
      const didHex = `${bytes[1].toString(16).padStart(2, '0')}${bytes[2].toString(16).padStart(2, '0')}`.toUpperCase();
      return {
        response: `6E ${didHex.substring(0, 2)} ${didHex.substring(2, 4)}`,
        decoded: `Positive Response 0x6E: Successfully wrote parameter to DID 0x${didHex}`,
        status: 'OK'
      };
    }

    // 0x31 RoutineControl
    if (sid === 0x31) {
      const routineType = bytes[1]; // 01 start, 02 stop, 03 request results
      const routineId = `${bytes[2]?.toString(16).padStart(2, '0') || '02'}${bytes[3]?.toString(16).padStart(2, '0') || '01'}`.toUpperCase();
      return {
        response: `71 ${routineType.toString(16).padStart(2, '0').toUpperCase()} ${routineId.substring(0, 2)} ${routineId.substring(2, 4)} 00`,
        decoded: `Positive Response 0x71: Routine 0x${routineId} Execution Successful (Status: Completed 0x00).`,
        status: 'OK'
      };
    }

    // 0x3E TesterPresent
    if (sid === 0x3E) {
      const suppressPos = (sub & 0x80) !== 0;
      if (suppressPos) {
        return {
          response: '',
          decoded: 'Positive Response Suppressed (0x80 set). Keepalive accepted.',
          status: 'OK'
        };
      }
      return {
        response: '7E 00',
        decoded: 'Positive Response 0x7E 00: Tester Present Acknowledged. Diagnostic Session Kept Alive.',
        status: 'OK'
      };
    }

    // 0x85 ControlDTCSetting
    if (sid === 0x85) {
      this.state.dtcsSuppressed = sub === 0x02;
      return {
        response: `C5 ${sub.toString(16).padStart(2, '0').toUpperCase()}`,
        decoded: `Positive Response 0xC5: ControlDTCSetting -> ${sub === 0x01 ? 'DTC Storage ON' : 'DTC Storage OFF (Suppressed)'}`,
        status: 'OK'
      };
    }

    // Standard OBD-II Mode 01-0A
    if (sid === 0x01) {
      // OBD Mode 1 Live PID
      const pid = sub;
      if (pid === 0x0C) {
        // Engine RPM = ((A*256)+B)/4 e.g. 750 RPM -> A=0x0B, B=0xB8
        return { response: '41 0C 0B B8', decoded: 'OBD-II Mode 01 PID 0x0C (Engine RPM): 750 RPM', status: 'OK' };
      }
      if (pid === 0x0D) {
        // Vehicle Speed
        return { response: '41 0D 00', decoded: 'OBD-II Mode 01 PID 0x0D (Vehicle Speed): 0 km/h (Stationary)', status: 'OK' };
      }
      if (pid === 0x05) {
        // Coolant Temp: A - 40 e.g. 88 C -> A = 128 (0x80)
        return { response: '41 05 80', decoded: 'OBD-II Mode 01 PID 0x05 (Engine Coolant Temp): 88 °C (190 °F)', status: 'OK' };
      }
      if (pid === 0x11) {
        // Throttle Position: (A * 100) / 255 e.g. 14% -> A = 36 (0x24)
        return { response: '41 11 24', decoded: 'OBD-II Mode 01 PID 0x11 (Throttle Position): 14.1 %', status: 'OK' };
      }
      return { response: `41 ${pid.toString(16).padStart(2, '0').toUpperCase()} 14 28`, decoded: `OBD-II Mode 01 PID 0x${pid.toString(16).toUpperCase()}: [14 28]`, status: 'OK' };
    }

    if (sid === 0x09) {
      if (sub === 0x02) {
        const asciiBytes = this.vin.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return { response: `49 02 01 ${asciiBytes}`, decoded: `OBD-II Mode 09 PID 0x02 (VIN): "${this.vin}"`, status: 'OK' };
      }
      if (sub === 0x04) {
        return { response: '49 04 01 46 4C 33 41', decoded: `OBD-II Mode 09 PID 0x04 (Calibration ID): "${this.calibrationId}"`, status: 'OK' };
      }
    }

    // Default NRC 0x11 Service Not Supported
    return {
      response: `7F ${sid.toString(16).padStart(2, '0').toUpperCase()} 11`,
      decoded: `Negative Response 0x7F [0x11]: Service 0x${sid.toString(16).toUpperCase()} Not Supported in Active Session`,
      status: 'NRC'
    };
  }

  // Generate realistic simulated CAN frames for CAN Sniffer
  public generateCanFrames(count: number = 1): CanMessage[] {
    const frames: CanMessage[] = [];
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    const templates = [
      { id: '0C0', data: ['00', '00', '1A', '32', '00', '00', '1B', 'E4'] }, // Engine RPM & Torque
      { id: '130', data: ['40', '00', '00', '80', '12', '00', '00', '00'] }, // Steering Angle & Yaw
      { id: '201', data: ['00', '00', '00', '00', '00', '00', '00', '00'] }, // ABS Wheel Speeds
      { id: '4B0', data: ['00', '12', '00', '14', '00', '11', '00', '13'] }, // Wheel pulse counters
      { id: '7E8', data: ['03', '7E', '00', '00', '00', '00', '00', '00'] }, // UDS Diagnostic Response
      { id: '3B0', data: ['1F', 'A2', '08', '00', '4C', '00', '12', 'FF'] }, // Instrument Cluster Status
      { id: '5A0', data: ['01', '00', '2C', '88', '00', '00', 'AA', '55'] }  // Body Control & Lighting
    ];

    for (let i = 0; i < count; i++) {
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      // add slight random variation to simulated sensor bytes
      const perturbed = tmpl.data.map((b, idx) => {
        if (idx === 2 || idx === 3) {
          return Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
        }
        return b;
      });

      const ascii = perturbed
        .map(b => {
          const code = parseInt(b, 16);
          return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.';
        })
        .join('');

      frames.push({
        id: Date.now() + i,
        timestamp: timeStr,
        canId: tmpl.id,
        isExtended: false,
        dlc: 8,
        data: perturbed,
        ascii
      });
    }

    return frames;
  }
}

export const ecuSimulator = new VirtualEcuEngine();
