import { DtcRecord } from '../types';

export const DTC_SUBCODES: Record<string, string> = {
  '00': 'No sub-type information',
  '01': 'General electrical failure',
  '02': 'General signal failure',
  '03': 'FM / PWM failure',
  '04': 'System internal failure',
  '05': 'System programming failure',
  '06': 'Algorithm based failure',
  '07': 'Mechanical failure',
  '08': 'Bus signal / message failure',
  '09': 'Component failure',
  '11': 'Circuit short to ground',
  '12': 'Circuit short to battery',
  '13': 'Circuit open',
  '14': 'Circuit short to ground or open',
  '15': 'Circuit short to battery or open',
  '16': 'Circuit voltage below threshold',
  '17': 'Circuit voltage above threshold',
  '18': 'Circuit current below threshold',
  '19': 'Circuit current above threshold',
  '1A': 'Circuit resistance below threshold',
  '1B': 'Circuit resistance above threshold',
  '1C': 'Circuit voltage out of range',
  '1D': 'Circuit current out of range',
  '1E': 'Circuit resistance is out of range',
  '1F': 'Circuit intermittent',
  '21': 'Signal amplitude < minimum',
  '22': 'Signal amplitude > maximum',
  '23': 'Signal stays low',
  '24': 'Signal stays high',
  '25': 'Signal shape / waveform failure',
  '28': 'Level bias / offset out of range',
  '29': 'Signal invalid',
  '2F': 'Signal erratic',
  '49': 'Internal electronic failure',
  '55': 'Not configured / Incorrect variant',
  '62': 'Signal compare failure',
  '63': 'Circuit / Component protection timeout',
  '64': 'Signal plausibility failure',
  '71': 'Actuator stuck',
  '72': 'Actuator stuck open',
  '73': 'Actuator stuck closed',
  '78': 'Alignment or adjustment incorrect',
  '81': 'Received serial data invalid',
  '86': 'Signal invalid',
  '87': 'Missing message',
  '88': 'Bus off',
  '92': 'Performance or incorrect operation',
  '93': 'No operation',
  '94': 'Unexpected operation'
};

export const COMMON_DTC_LIST: Record<string, string> = {
  // Powertrain - Fuel & Air Metering
  'P0001': 'Fuel Volume Regulator Control Circuit / Open',
  'P0002': 'Fuel Volume Regulator Control Circuit Range / Performance',
  'P0003': 'Fuel Volume Regulator Control Circuit Low',
  'P0004': 'Fuel Volume Regulator Control Circuit High',
  'P0005': 'Fuel Shutoff Valve Control Circuit / Open',
  'P0008': 'Engine Position System Performance (Bank 1)',
  'P0010': 'A Camshaft Position Actuator Circuit (Bank 1)',
  'P0011': 'A Camshaft Position - Timing Over-Advanced (Bank 1)',
  'P0012': 'A Camshaft Position - Timing Over-Retarded (Bank 1)',
  'P0016': 'Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor A)',
  'P0030': 'HO2S Heater Control Circuit (Bank 1 Sensor 1)',
  'P0031': 'HO2S Heater Control Circuit Low (Bank 1 Sensor 1)',
  'P0036': 'HO2S Heater Control Circuit (Bank 1 Sensor 2)',
  'P0087': 'Fuel Rail / System Pressure - Too Low',
  'P0088': 'Fuel Rail / System Pressure - Too High',
  'P0089': 'Fuel Pressure Regulator 1 Performance',
  'P0093': 'Fuel System Leak Detected - Large Leak',
  'P0100': 'Mass or Volume Air Flow Circuit Malfunction',
  'P0101': 'Mass or Volume Air Flow Circuit Range / Performance',
  'P0102': 'Mass or Volume Air Flow Circuit Low Input',
  'P0103': 'Mass or Volume Air Flow Circuit High Input',
  'P0106': 'Manifold Absolute Pressure / Barometric Pressure Range / Performance',
  'P0110': 'Intake Air Temperature Circuit Malfunction',
  'P0115': 'Engine Coolant Temperature Circuit Malfunction',
  'P0117': 'Engine Coolant Temperature Circuit Low Input',
  'P0118': 'Engine Coolant Temperature Circuit High Input',
  'P0120': 'Throttle / Pedal Position Sensor / Switch A Circuit Malfunction',
  'P0128': 'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temp)',
  'P0130': 'O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)',
  'P0135': 'O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 1)',
  'P0171': 'System Too Lean (Bank 1)',
  'P0172': 'System Too Rich (Bank 1)',
  'P0174': 'System Too Lean (Bank 2)',
  'P0175': 'System Too Rich (Bank 2)',
  'P0200': 'Injector Circuit Malfunction',
  'P0201': 'Injector Circuit Malfunction - Cylinder 1',
  'P0202': 'Injector Circuit Malfunction - Cylinder 2',
  'P0203': 'Injector Circuit Malfunction - Cylinder 3',
  'P0204': 'Injector Circuit Malfunction - Cylinder 4',
  'P0219': 'Engine Overspeed Condition',
  'P0234': 'Turbocharger / Supercharger Overboost Condition',
  'P0299': 'Turbocharger / Supercharger Underboost',
  'P0300': 'Random / Multiple Cylinder Misfire Detected',
  'P0301': 'Cylinder 1 Misfire Detected',
  'P0302': 'Cylinder 2 Misfire Detected',
  'P0303': 'Cylinder 3 Misfire Detected',
  'P0304': 'Cylinder 4 Misfire Detected',
  'P0325': 'Knock Sensor 1 Circuit Malfunction (Bank 1 or Single Sensor)',
  'P0335': 'Crankshaft Position Sensor A Circuit Malfunction',
  'P0340': 'Camshaft Position Sensor A Circuit Malfunction (Bank 1)',
  'P0400': 'Exhaust Gas Recirculation Flow Malfunction',
  'P0401': 'Exhaust Gas Recirculation Flow Insufficient Detected',
  'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
  'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2)',
  'P0440': 'Evaporative Emission Control System Malfunction',
  'P0442': 'Evaporative Emission Control System Leak Detected (Small Leak)',
  'P0455': 'Evaporative Emission Control System Leak Detected (Gross Leak)',
  'P0500': 'Vehicle Speed Sensor Malfunction',
  'P0505': 'Idle Control System Malfunction',
  'P0562': 'System Voltage Low',
  'P0563': 'System Voltage High',
  'P0600': 'Serial Communication Link Malfunction',
  'P0605': 'Internal Control Module Read Only Memory (ROM) Error',
  'P0606': 'ECM / PCM Processor Fault',
  'P0700': 'Transmission Control System Malfunction',
  'P0715': 'Input / Turbine Speed Sensor Circuit Malfunction',
  'P0720': 'Output Speed Sensor Circuit Malfunction',
  'P0730': 'Incorrect Gear Ratio',
  'P0740': 'Torque Converter Clutch Circuit Malfunction',
  'P1607': 'MIL Output Circuit Malfunction (Manufacturer Specific)',
  
  // Chassis Codes
  'C0031': 'Left Front Wheel Speed Sensor Malfunction',
  'C0034': 'Right Front Wheel Speed Sensor Malfunction',
  'C0037': 'Left Rear Wheel Speed Sensor Malfunction',
  'C003A': 'Right Rear Wheel Speed Sensor Malfunction',
  'C0040': 'Brake Pedal Switch A Malfunction',
  'C0044': 'Brake Pressure Sensor A Malfunction',
  'C0051': 'Steering Wheel Position Sensor Malfunction',
  'C0061': 'Lateral Acceleration Sensor Malfunction',
  'C0062': 'Longitudinal Acceleration Sensor Malfunction',
  'C0063': 'Yaw Rate Sensor Malfunction',
  'C1234': 'Wheel Speed Sensor Input Missing',
  'C1465': 'Damper High Side Front Circuit Short To Battery',
  
  // Body Codes
  'B0001': 'Driver Frontal Stage 1 Deployment Control',
  'B0002': 'Driver Frontal Stage 2 Deployment Control',
  'B0010': 'Passenger Frontal Stage 1 Deployment Control',
  'B0020': 'Left Side Airbag Deployment Control',
  'B0028': 'Right Side Airbag Deployment Control',
  'B1000': 'ECU Internal Fault - Restraints Control Module',
  'B1455': 'Wiper Washer Fluid Lamp Circuit Open',
  'B1956': 'Seat Front Up/Down Potentiometer Feedback Circuit Short',
  'B2000': 'Keyless Entry Antenna Module Fault',
  
  // Network / Communication Codes
  'U0001': 'High Speed CAN Communication Bus',
  'U0073': 'Control Module Communication Bus Off',
  'U0100': 'Lost Communication With ECM / PCM A',
  'U0101': 'Lost Communication with TCM (Transmission Control Module)',
  'U0121': 'Lost Communication With Anti-Lock Brake System (ABS) Module',
  'U0140': 'Lost Communication With Body Control Module (BCM)',
  'U0151': 'Lost Communication With Restraints Control Module',
  'U0155': 'Lost Communication With Instrument Panel Cluster (IPC)',
  'U0164': 'Lost Communication With HVAC Control Module',
  'U0401': 'Invalid Data Received From ECM / PCM',
  'U0415': 'Invalid Data Received From ABS Module',
  'U1089': 'SCP Invalid or Missing Data for Suspension',
  'U3000': 'Control Module General Internal Failure'
};

export function parseDtcFromBytes(byte1: number, byte2: number, byte3?: number, statusByte?: number): DtcRecord {
  // SAE J2012 / ISO 14229 formula:
  // First nibble bits 7-6: 00 = P, 01 = C, 10 = B, 11 = U
  const typeCode = (byte1 >> 6) & 0x03;
  let typePrefix = 'P';
  let typeCategory: DtcRecord['type'] = 'Powertrain (P)';

  if (typeCode === 1) {
    typePrefix = 'C';
    typeCategory = 'Chassis (C)';
  } else if (typeCode === 2) {
    typePrefix = 'B';
    typeCategory = 'Body (B)';
  } else if (typeCode === 3) {
    typePrefix = 'U';
    typeCategory = 'Network (U)';
  }

  // Second digit: bits 5-4 of byte1 (0, 1, 2, 3)
  const digit2 = (byte1 >> 4) & 0x03;
  const globalType: 'Global' | 'Manufacturer' = (digit2 === 0 || digit2 === 2) ? 'Global' : 'Manufacturer';

  // Third digit: bits 3-0 of byte1
  const digit3 = (byte1 & 0x0F).toString(16).toUpperCase();

  // Fourth and Fifth digits: byte2
  const digit45 = byte2.toString(16).padStart(2, '0').toUpperCase();

  const baseCode = `${typePrefix}${digit2}${digit3}${digit45}`;
  const subTypeHex = byte3 !== undefined ? byte3.toString(16).padStart(2, '0').toUpperCase() : undefined;
  const fullCode = subTypeHex ? `${baseCode}-${subTypeHex}` : baseCode;

  const baseDefinition = COMMON_DTC_LIST[baseCode] || `${typeCategory} Diagnostic Trouble Code ${baseCode}`;
  const subDefinition = subTypeHex && DTC_SUBCODES[subTypeHex] ? ` (${DTC_SUBCODES[subTypeHex]})` : '';

  const status = statusByte ?? 0x2F;
  const statusFlags = {
    testFailed: !!(status & 0x01),
    testFailedThisCycle: !!(status & 0x02),
    pendingDTC: !!(status & 0x04),
    confirmedDTC: !!(status & 0x08),
    testNotCompletedSinceClear: !!(status & 0x10),
    warningIndicatorRequested: !!(status & 0x80)
  };

  return {
    id: fullCode,
    code: fullCode,
    global: globalType,
    type: typeCategory,
    subType: subTypeHex ? `${subTypeHex} - ${DTC_SUBCODES[subTypeHex] || 'Unknown sub-type'}` : '00 - No sub-type',
    definition: `${baseDefinition}${subDefinition}`,
    statusByte: `0x${status.toString(16).padStart(2, '0').toUpperCase()}`,
    statusFlags
  };
}

export function parseDtcString(codeStr: string): DtcRecord {
  const clean = codeStr.trim().toUpperCase();
  const parts = clean.split('-');
  const base = parts[0];
  const sub = parts[1] || '00';

  const typeLetter = base.charAt(0);
  let typeCategory: DtcRecord['type'] = 'Powertrain (P)';
  if (typeLetter === 'C') typeCategory = 'Chassis (C)';
  if (typeLetter === 'B') typeCategory = 'Body (B)';
  if (typeLetter === 'U') typeCategory = 'Network (U)';

  const digit2 = base.charAt(1);
  const global: 'Global' | 'Manufacturer' = (digit2 === '0' || digit2 === '2') ? 'Global' : 'Manufacturer';
  const baseDef = COMMON_DTC_LIST[base] || `${typeCategory} Trouble Code ${base}`;
  const subDef = DTC_SUBCODES[sub] ? ` (${DTC_SUBCODES[sub]})` : '';

  return {
    id: clean,
    code: clean,
    global,
    type: typeCategory,
    subType: `${sub} - ${DTC_SUBCODES[sub] || 'General'}` ,
    definition: `${baseDef}${subDef}`,
    statusByte: '0x2F',
    statusFlags: {
      confirmedDTC: true,
      pendingDTC: true,
      testFailed: false
    }
  };
}
