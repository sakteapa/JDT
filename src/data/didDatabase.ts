export interface DidDefinition {
  did: string;
  name: string;
  description?: string;
  category: 'System' | 'Identification' | 'Configuration' | 'Powertrain' | 'Sensor' | 'Emissions';
}

export const DID_DATABASE: Record<string, DidDefinition> = {
  // ISO 14229 Standard DIDs (F100 - FA07)
  'F100': { did: 'F100', name: 'Bootloader Software Version Number', category: 'System' },
  'F102': { did: 'F102', name: 'Security Constant', category: 'System' },
  'F103': { did: 'F103', name: 'Active Network Configuration Number', category: 'Configuration' },
  'F104': { did: 'F104', name: 'Master Network Configuration Part Number', category: 'Configuration' },
  'F105': { did: 'F105', name: 'Vehicle Build Parameters', category: 'Configuration' },
  'F106': { did: 'F106', name: 'Vehicle Configuration Parameters (As-Built Data)', category: 'Configuration' },
  'F107': { did: 'F107', name: 'Drivetrain Configuration Of The Vehicle', category: 'Configuration' },
  'F108': { did: 'F108', name: 'ECU Network Signal Calibration Number', category: 'Configuration' },
  'F109': { did: 'F109', name: 'Boot Software Version Number', category: 'System' },
  'F110': { did: 'F110', name: 'Diagnostic Specification Part Number', category: 'System' },
  'F111': { did: 'F111', name: 'ECU Core Assembly Number', category: 'Identification' },
  'F112': { did: 'F112', name: 'ECU Assembly Number', category: 'Identification' },
  'F113': { did: 'F113', name: 'ECU Delivery Assembly Number', category: 'Identification' },
  'F114': { did: 'F114', name: 'Vehicle Information Section (VIS)', category: 'Identification' },
  'F115': { did: 'F115', name: 'HS CAN ECU Addresses', category: 'System' },
  'F116': { did: 'F116', name: 'MS CAN ECU Addresses', category: 'System' },
  'F120': { did: 'F120', name: 'ECU Software #2 Part Number', category: 'System' },
  'F180': { did: 'F180', name: 'Boot Software Identification', category: 'System' },
  'F187': { did: 'F187', name: 'Vehicle Manufacturer Spare Part Number', category: 'Identification' },
  'F188': { did: 'F188', name: 'Vehicle Manufacturer ECU Software Number (Strategy)', category: 'Identification' },
  'F189': { did: 'F189', name: 'Vehicle Manufacturer ECU Software Assembly Number', category: 'Identification' },
  'F18A': { did: 'F18A', name: 'System Supplier Identifier (Bosch/Conti/Denso)', category: 'Identification' },
  'F18B': { did: 'F18B', name: 'ECU Manufacturing Date', category: 'Identification' },
  'F18C': { did: 'F18C', name: 'ECU Serial Number', category: 'Identification' },
  'F18D': { did: 'F18D', name: 'Supported Functional Units', category: 'System' },
  'F190': { did: 'F190', name: 'VIN (Vehicle Identification Number)', category: 'Identification' },
  'F191': { did: 'F191', name: 'Vehicle Manufacturer ECU Hardware Number', category: 'Identification' },
  'F196': { did: 'F196', name: 'Exhaust Regulation or Type Approval Number', category: 'Emissions' },
  'F197': { did: 'F197', name: 'System Name or Engine Type', category: 'Identification' },
  'F198': { did: 'F198', name: 'Repair Shop Code or Tester Serial Number', category: 'System' },
  'F199': { did: 'F199', name: 'Programming Date (Flash Date)', category: 'System' },
  'F19A': { did: 'F19A', name: 'Calibration Repair Shop Code / Calibration Tool ID', category: 'System' },
  'F19B': { did: 'F19B', name: 'Calibration Date', category: 'System' },
  'F19C': { did: 'F19C', name: 'Calibration Equipment Software Number', category: 'System' },
  'F19D': { did: 'F19D', name: 'ECU Installation Date', category: 'System' },
  'F19E': { did: 'F19E', name: 'ASAM File Identifier (ODX/MDX Container)', category: 'System' },

  // Powertrain & Sensor DIDs (0100 - 0130)
  '0102': { did: '0102', name: 'Air Cleaner Housing Door/Flap Control', category: 'Powertrain' },
  '0103': { did: '0103', name: 'Air-Fuel Mass Ratio at Lambda 1', category: 'Powertrain' },
  '0104': { did: '0104', name: 'Percent Alcohol Learning Status (Flex Fuel)', category: 'Powertrain' },
  '0105': { did: '0105', name: 'Fuel Learning Enable Conditions', category: 'Powertrain' },
  '0106': { did: '0106', name: 'DPFE EGR Differential Pressure Offset Value', category: 'Emissions' },
  '0107': { did: '0107', name: 'Fuel Injector 7 Fault Status', category: 'Powertrain' },
  '0108': { did: '0108', name: 'Fuel Injector 8 Fault Status', category: 'Powertrain' },
  '0109': { did: '0109', name: 'Turbocharger Wastegate A Commanded Position', category: 'Powertrain' },
  '010A': { did: '010A', name: 'Turbine Inlet Valve A Duty Cycle', category: 'Powertrain' },
  '010F': { did: '010F', name: 'Boost Pressure Actuator Bank 1 Duty Cycle', category: 'Powertrain' },
  '0110': { did: '0110', name: 'Turbocharger Turbine Inlet Valve A Position Measured', category: 'Sensor' },
  '0111': { did: '0111', name: 'Boost Sensor A Fault Status', category: 'Sensor' },
  '0112': { did: '0112', name: 'Crankcase Pressure Sensor Fault Status', category: 'Sensor' },
  '0113': { did: '0113', name: 'Particulate Filter Pressure Sensor A Status', category: 'Emissions' },
  '0114': { did: '0114', name: 'Charge Air Cooler Temperature Bank 1', category: 'Sensor' },
  '0117': { did: '0117', name: 'Auxiliary Coolant Pump Speed Commanded', category: 'Powertrain' },
  '0120': { did: '0120', name: 'Starter/Generator Operation Mode', category: 'Powertrain' },
  '0121': { did: '0121', name: 'Cylinder Deactivation State', category: 'Powertrain' },
  '0129': { did: '0129', name: 'Engine Oil Level Sensor Fault Status', category: 'Sensor' },
  '012B': { did: '012B', name: 'DFI Specific Long Term Fuel Trim Bank 1', category: 'Powertrain' },
  'F812': { did: 'F812', name: 'Engine Ignition Cycle Counter', category: 'System' },
  'F814': { did: 'F814', name: 'Distance Traveled Since Evap Monitoring', category: 'Emissions' },
  'F816': { did: 'F816', name: 'Engine Run / Idle Time Total', category: 'System' },
  'F817': { did: 'F817', name: 'Total Distance / Total Fuel Consumed', category: 'System' },
  'FA00': { did: 'FA00', name: 'Number of Pyrotechnic Restraint Units in Vehicle', category: 'System' },
  'FA01': { did: 'FA01', name: 'Pyrotechnic Deployment Method', category: 'System' }
};

export function lookupDid(hexDid: string): DidDefinition {
  const formatted = hexDid.trim().toUpperCase().padStart(4, '0');
  if (DID_DATABASE[formatted]) {
    return DID_DATABASE[formatted];
  }

  // Common fallbacks based on address range
  if (formatted.startsWith('F1')) {
    return { did: formatted, name: `Vehicle / ECU Identification DID 0x${formatted}`, category: 'Identification' };
  }
  if (formatted.startsWith('01') || formatted.startsWith('02')) {
    return { did: formatted, name: `Powertrain Dynamic Parameter 0x${formatted}`, category: 'Powertrain' };
  }
  if (formatted.startsWith('FA') || formatted.startsWith('FB')) {
    return { did: formatted, name: `Safety / Restraints Parameter 0x${formatted}`, category: 'System' };
  }
  return { did: formatted, name: `Vendor Specific Diagnostic Identifier 0x${formatted}`, category: 'System' };
}
