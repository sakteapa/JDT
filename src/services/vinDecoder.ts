export interface DecodedVin {
  vin: string;
  isValidChecksum: boolean;
  wmi: string;
  vds: string;
  vis: string;
  manufacturer: string;
  country: string;
  region: string;
  vehicleType: string;
  model: string;
  year: string;
  plant: string;
  serialNumber: string;
  engineSpec?: string;
  bodyStyle?: string;
}

const WMI_DATABASE: Record<string, { manufacturer: string; country: string; region: string }> = {
  // North America (1-5)
  '1FT': { manufacturer: 'Ford Motor Company (USA Trucks)', country: 'United States', region: 'North America' },
  '1FA': { manufacturer: 'Ford Motor Company (USA Cars)', country: 'United States', region: 'North America' },
  '1FM': { manufacturer: 'Ford Motor Company (USA SUV/MPV)', country: 'United States', region: 'North America' },
  '1FD': { manufacturer: 'Ford Motor Company (Incomplete)', country: 'United States', region: 'North America' },
  '1G1': { manufacturer: 'General Motors / Chevrolet', country: 'United States', region: 'North America' },
  '1GC': { manufacturer: 'Chevrolet Truck', country: 'United States', region: 'North America' },
  '1HG': { manufacturer: 'Honda of America Mfg.', country: 'United States', region: 'North America' },
  '1J4': { manufacturer: 'Jeep (Chrysler)', country: 'United States', region: 'North America' },
  '2FM': { manufacturer: 'Ford Motor Company of Canada', country: 'Canada', region: 'North America' },
  '2G1': { manufacturer: 'Chevrolet Canada', country: 'Canada', region: 'North America' },
  '3FA': { manufacturer: 'Ford Motor Company Mexico', country: 'Mexico', region: 'North America' },
  '3VW': { manufacturer: 'Volkswagen de Mexico', country: 'Mexico', region: 'North America' },
  '4T1': { manufacturer: 'Toyota Motor Manufacturing Kentucky', country: 'United States', region: 'North America' },
  '5YJ': { manufacturer: 'Tesla Motors Inc.', country: 'United States', region: 'North America' },

  // Europe (S-Z)
  'SAL': { manufacturer: 'Land Rover (Jaguar Land Rover)', country: 'United Kingdom', region: 'Europe' },
  'SAJ': { manufacturer: 'Jaguar Cars Ltd.', country: 'United Kingdom', region: 'Europe' },
  'SCC': { manufacturer: 'Lotus Cars', country: 'United Kingdom', region: 'Europe' },
  'SHS': { manufacturer: 'Honda of the UK Mfg.', country: 'United Kingdom', region: 'Europe' },
  'VF1': { manufacturer: 'Renault', country: 'France', region: 'Europe' },
  'VF3': { manufacturer: 'Peugeot (Stellantis)', country: 'France', region: 'Europe' },
  'VF7': { manufacturer: 'Citroën (Stellantis)', country: 'France', region: 'Europe' },
  'WAU': { manufacturer: 'Audi AG', country: 'Germany', region: 'Europe' },
  'WBA': { manufacturer: 'BMW AG (Bavarian Motor Works)', country: 'Germany', region: 'Europe' },
  'WBS': { manufacturer: 'BMW M GmbH High Performance', country: 'Germany', region: 'Europe' },
  'WDB': { manufacturer: 'Mercedes-Benz AG', country: 'Germany', region: 'Europe' },
  'WDC': { manufacturer: 'DaimlerChrysler AG / Mercedes', country: 'Germany', region: 'Europe' },
  'WF0': { manufacturer: 'Ford-Werke GmbH (Ford of Europe)', country: 'Germany', region: 'Europe' },
  'WP0': { manufacturer: 'Porsche AG', country: 'Germany', region: 'Europe' },
  'WVW': { manufacturer: 'Volkswagen AG', country: 'Germany', region: 'Europe' },
  'YV1': { manufacturer: 'Volvo Car Corporation', country: 'Sweden', region: 'Europe' },
  'ZAM': { manufacturer: 'Maserati S.p.A.', country: 'Italy', region: 'Europe' },
  'ZAR': { manufacturer: 'Alfa Romeo (Stellantis)', country: 'Italy', region: 'Europe' },
  'ZFA': { manufacturer: 'Fiat Automobiles S.p.A.', country: 'Italy', region: 'Europe' },
  'ZFF': { manufacturer: 'Ferrari S.p.A.', country: 'Italy', region: 'Europe' },

  // Asia (J-R)
  'JHM': { manufacturer: 'Honda Motor Co., Ltd.', country: 'Japan', region: 'Asia' },
  'JM1': { manufacturer: 'Mazda Motor Corporation', country: 'Japan', region: 'Asia' },
  'JN1': { manufacturer: 'Nissan Motor Co., Ltd.', country: 'Japan', region: 'Asia' },
  'JT2': { manufacturer: 'Toyota Motor Corporation (Truck)', country: 'Japan', region: 'Asia' },
  'JTD': { manufacturer: 'Toyota Motor Corporation (Passenger)', country: 'Japan', region: 'Asia' },
  'JF1': { manufacturer: 'Subaru Corporation', country: 'Japan', region: 'Asia' },
  'KL1': { manufacturer: 'GM Daewoo / Chevrolet Korea', country: 'South Korea', region: 'Asia' },
  'KMH': { manufacturer: 'Hyundai Motor Company', country: 'South Korea', region: 'Asia' },
  'KNA': { manufacturer: 'Kia Corporation', country: 'South Korea', region: 'Asia' },

  // Oceania (6-7)
  '6FP': { manufacturer: 'Ford Motor Company of Australia', country: 'Australia', region: 'Oceania' },
  '6G1': { manufacturer: 'Holden (General Motors Australia)', country: 'Australia', region: 'Oceania' },
  '7A3': { manufacturer: 'Toyota Motor Corporation Australia', country: 'Australia', region: 'Oceania' }
};

const YEAR_CODES: Record<string, string> = {
  'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
  'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
  'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
  'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029',
  'Y': '2000', '1': '2001', '2': '2002', '3': '2003', '4': '2004',
  '5': '2005', '6': '2006', '7': '2007', '8': '2008', '9': '2009'
};

const VIN_CHAR_VALUES: Record<string, number> = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
  'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
  'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 0
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function validateVinChecksum(vin: string): boolean {
  if (vin.length !== 17) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i];
    const val = VIN_CHAR_VALUES[char];
    if (val === undefined) return false;
    sum += val * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expectedCheck = remainder === 10 ? 'X' : remainder.toString();
  return vin[8] === expectedCheck;
}

export function decodeVin(rawVin: string): DecodedVin {
  const vin = rawVin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const wmi = vin.substring(0, 3);
  const vds = vin.length >= 9 ? vin.substring(3, 9) : vin.substring(3);
  const vis = vin.length >= 17 ? vin.substring(9, 17) : vin.substring(9);

  const mfrData = WMI_DATABASE[wmi] || {
    manufacturer: `Manufacturer (${wmi})`,
    country: 'International / Unlisted',
    region: 'Global'
  };

  const yearChar = vin.length >= 10 ? vin[9] : '';
  const year = YEAR_CODES[yearChar] || 'Unknown / Pre-2000';
  const plant = vin.length >= 11 ? `Plant Code '${vin[10]}'` : 'Standard Production';
  const serial = vin.length >= 17 ? vin.substring(11, 17) : (vin.substring(11) || '000000');
  const isValidChecksum = vin.length === 17 ? validateVinChecksum(vin) : false;

  // Infer basic model info from VDS
  let modelInfo = 'Standard Variant';
  let bodyStyle = 'Unspecified';
  let engineSpec = 'Electronic Fuel Injection / Direct Injection';

  if (wmi.startsWith('1FT') || wmi.startsWith('1FA') || wmi.startsWith('WF0') || wmi.startsWith('6FP')) {
    modelInfo = 'Ford Series (F-Series / Falcon / Ranger / Focus)';
    bodyStyle = 'Sedan / Utility / Dual Cab';
    engineSpec = 'Duratec / EcoBoost / Barra Inline-6';
  } else if (wmi.startsWith('SAL') || wmi.startsWith('SAJ')) {
    modelInfo = 'Jaguar Land Rover (Range Rover / Discovery / Defender / F-Pace)';
    bodyStyle = 'Luxury SUV / Saloon';
    engineSpec = 'Ingenium 2.0L Turbo / 3.0L Supercharged V6';
  } else if (wmi.startsWith('WAU') || wmi.startsWith('WVW')) {
    modelInfo = 'VAG Platform (MQB / MLB Architecture)';
    bodyStyle = '5-Door Hatch / Avant / Saloon';
    engineSpec = '2.0 TFSI / EA888 Gen 3/4';
  } else if (wmi.startsWith('WDB') || wmi.startsWith('WDC')) {
    modelInfo = 'Mercedes-Benz Passenger Car (W205 / W213 / W222 / X253)';
    bodyStyle = 'Executive Saloon / SUV';
    engineSpec = 'M274 / OM654 BlueTEC Diesel';
  } else if (wmi.startsWith('VF')) {
    modelInfo = 'PSA Group Passenger Platform';
    bodyStyle = 'Hatchback / Crossover';
    engineSpec = 'PureTech 1.2 / BlueHDi 1.6-2.0';
  }

  return {
    vin,
    isValidChecksum,
    wmi,
    vds,
    vis,
    manufacturer: mfrData.manufacturer,
    country: mfrData.country,
    region: mfrData.region,
    vehicleType: 'Passenger / Light Commercial Automobile',
    model: modelInfo,
    year,
    plant,
    serialNumber: serial,
    engineSpec,
    bodyStyle
  };
}
