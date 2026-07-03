/**
 * Vehicle models by make - Canada market.
 * Maps each make (brand) to its available models.
 */

export type VehicleModelsMap = Record<string, string[]>

export const VEHICLE_MODELS_BY_MAKE_CA: VehicleModelsMap = {
  Acura: ['Integra', 'TLX', 'ILX', 'RLX', 'RDX', 'MDX', 'ZDX', 'NSX'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale', '4C', 'Spider'],
  'Aston Martin': ['DB12', 'Vantage', 'DBS', 'DBX', 'Valhalla'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'e-tron GT', 'RS3', 'RS5', 'RS6', 'RS7', 'RSQ8', 'SQ5', 'SQ7', 'SQ8'],
  Bentley: ['Bentayga', 'Flying Spur', 'Continental GT', 'Mulsanne'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'i4', 'i5', 'i7', 'iX', 'Z4', 'M2', 'M3', 'M4', 'M5', 'M8'],
  Buick: ['Encore', 'Encore GX', 'Envision', 'Enclave', 'Regal', 'LaCrosse'],
  BYD: ['Atto 3', 'Seal', 'Han', 'Tang', 'Dolphin', 'Seagull'],
  Cadillac: ['CT4', 'CT5', 'XT4', 'XT5', 'XT6', 'Escalade', 'Lyriq', 'Celestiq'],
  Chevrolet: ['Spark', 'Malibu', 'Camaro', 'Corvette', 'Trax', 'Trailblazer', 'Equinox', 'Blazer', 'Traverse', 'Tahoe', 'Suburban', 'Colorado', 'Silverado', 'Bolt', 'Bolt EUV'],
  Chrysler: ['Pacifica', '300', 'Voyager'],
  Dodge: ['Charger', 'Challenger', 'Durango', 'Hornet'],
  Ferrari: ['296', 'Roma', 'Portofino', 'SF90', 'Purosangue', 'F8', '812'],
  Fisker: ['Ocean', 'Pear', 'Ronin'],
  Ford: ['Fiesta', 'Focus', 'Fusion', 'Mustang', 'EcoSport', 'Escape', 'Edge', 'Explorer', 'Expedition', 'Bronco', 'Bronco Sport', 'Maverick', 'Ranger', 'F-150', 'F-150 Lightning', 'Super Duty', 'Transit'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  GMC: ['Terrain', 'Acadia', 'Canyon', 'Sierra', 'Hummer EV', 'Yukon'],
  Honda: ['Civic', 'Civic Si', 'Civic Type R', 'Accord', 'Accord Hybrid', 'HR-V', 'CR-V', 'CR-V Hybrid', 'Passport', 'Pilot', 'Odyssey', 'Ridgeline', 'Prologue'],
  Hummer: ['Hummer EV', 'Hummer EV SUV'],
  Hyundai: ['Accent', 'Elantra', 'Sonata', 'Kona', 'Tucson', 'Santa Fe', 'Santa Cruz', 'Palisade', 'IONIQ 5', 'IONIQ 6', 'Genesis'],
  Infiniti: ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80'],
  Jaguar: ['XE', 'XF', 'F-Type', 'E-PACE', 'F-PACE', 'I-PACE'],
  Jeep: ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wagoneer', 'Grand Wagoneer', 'Wrangler', 'Gladiator'],
  Kia: ['Rio', 'Forte', 'K4', 'K5', 'Stinger', 'Seltos', 'Sportage', 'Sorento', 'Telluride', 'EV4', 'EV5', 'EV6', 'EV9', 'Carnival', 'Niro'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque'],
  Lexus: ['IS', 'ES', 'GS', 'LS', 'RC', 'LC', 'UX', 'NX', 'RX', 'GX', 'LX', 'RZ'],
  Lincoln: ['Corsair', 'Nautilus', 'Aviator', 'Navigator', 'MKZ', 'Continental'],
  Lotus: ['Emira', 'Eletre', 'Evija'],
  Lucid: ['Air', 'Gravity'],
  Maserati: ['Ghibli', 'Quattroporte', 'Levante', 'Grecale', 'MC20'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-60', 'CX-70', 'CX-90', 'MX-5 Miata'],
  McLaren: ['Artura', '750S', '765LT', 'GT'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLS', 'AMG GT', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'EQB', 'EQS', 'EQE', 'EQA'],
  MINI: ['Cooper', 'Cooper S', 'Countryman', 'Clubman', 'Convertible'],
  Mitsubishi: ['Mirage', 'Eclipse Cross', 'Outlander', 'Outlander PHEV', 'Outlander Sport'],
  Nissan: ['Versa', 'Sentra', 'Altima', 'Maxima', 'Z', 'GT-R', 'Kicks', 'Rogue', 'Murano', 'Pathfinder', 'Armada', 'Ariya', 'Leaf'],
  Polestar: ['2', '3', '4'],
  Porsche: ['718', '911', 'Panamera', 'Taycan', 'Macan', 'Cayenne', 'Cayenne Coupe'],
  Ram: ['1500', '2500', '3500', 'ProMaster'],
  Rivian: ['R1T', 'R1S'],
  'Rolls-Royce': ['Ghost', 'Wraith', 'Dawn', 'Phantom', 'Cullinan', 'Spectre'],
  Subaru: ['Impreza', 'WRX', 'BRZ', 'Legacy', 'Outback', 'Crosstrek', 'Forester', 'Ascent', 'Solterra'],
  Suzuki: ['Swift', 'Baleno', 'Jimny', 'Vitara', 'S-Cross'],
  Toyota: ['Yaris', 'Corolla', 'Corolla Cross', 'Camry', 'Crown', 'Prius', 'GR86', 'GR Supra', 'GR Corolla', 'bZ4X', 'C-HR', 'RAV4', 'Highlander', 'Sequoia', '4Runner', 'Land Cruiser', 'Sienna', 'Tacoma', 'Tundra'],
  VinFast: ['VF 8', 'VF 9', 'VF 7'],
  Volkswagen: ['Golf', 'Golf GTI', 'Golf R', 'Jetta', 'Passat', 'Arteon', 'Taos', 'Tiguan', 'Atlas', 'Atlas Cross Sport', 'ID.4', 'ID Buzz'],
  Volvo: ['S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90', 'C40', 'EX30', 'EX90'],
}

/** Trims/submodels by make and model. Key format: "Make|Model" */
export type VehicleTrimsMap = Record<string, string[]>

export const VEHICLE_TRIMS_BY_MAKE_MODEL: VehicleTrimsMap = {
  // BMW
  'BMW|2 Series': ['228i', '230i', 'M235i', 'M2'],
  'BMW|3 Series': ['320i', '330i', '330e', 'M340i', 'M3'],
  'BMW|4 Series': ['430i', '440i', 'M440i', 'M4'],
  'BMW|5 Series': ['530i', '530e', '540i', 'M550i', 'M5'],
  'BMW|7 Series': ['740i', '760i', 'i7'],
  'BMW|X1': ['sDrive28i', 'xDrive28i'],
  'BMW|X3': ['sDrive30i', 'xDrive30i', 'M40i', 'M'],
  'BMW|X5': ['sDrive40i', 'xDrive40i', 'xDrive45e', 'M60i', 'M'],
  'BMW|i4': ['eDrive35', 'eDrive40', 'xDrive40', 'M50'],
  // Mercedes-Benz
  'Mercedes-Benz|A-Class': ['A 220', 'A 220 4MATIC'],
  'Mercedes-Benz|C-Class': ['C 300', 'C 300 4MATIC', 'C 43 AMG', 'C 63 AMG'],
  'Mercedes-Benz|E-Class': ['E 350', 'E 350 4MATIC', 'E 450', 'E 450 4MATIC', 'E 53 AMG', 'E 63 AMG'],
  'Mercedes-Benz|S-Class': ['S 500', 'S 580', 'S 580e', 'Maybach S 580', 'AMG S 63'],
  'Mercedes-Benz|GLA': ['GLA 250', 'GLA 250 4MATIC', 'AMG GLA 35'],
  'Mercedes-Benz|GLB': ['GLB 250', 'GLB 250 4MATIC', 'AMG GLB 35'],
  'Mercedes-Benz|GLC': ['GLC 300', 'GLC 300 4MATIC', 'GLC 43 AMG', 'GLC 63 AMG'],
  'Mercedes-Benz|GLE': ['GLE 350', 'GLE 350 4MATIC', 'GLE 450', 'GLE 53 AMG', 'GLE 63 AMG'],
  'Mercedes-Benz|GLS': ['GLS 450', 'GLS 580', 'Maybach GLS 600', 'AMG GLS 63'],
  // Audi
  'Audi|A3': ['Premium', 'Premium Plus', 'Prestige', 'S3', 'RS 3'],
  'Audi|A4': ['Premium', 'Premium Plus', 'Prestige', 'S4', 'RS 4'],
  'Audi|A5': ['Premium', 'Premium Plus', 'Prestige', 'S5', 'RS 5'],
  'Audi|A6': ['Premium', 'Premium Plus', 'Prestige', 'S6', 'RS 6'],
  'Audi|Q5': ['Premium', 'Premium Plus', 'Prestige', 'SQ5'],
  'Audi|Q7': ['Premium', 'Premium Plus', 'Prestige', 'SQ7'],
  // Lexus
  'Lexus|ES': ['250', '300h', '350', '350 F Sport'],
  'Lexus|RX': ['350', '350h', '450h', '500h', '350 F Sport'],
  'Lexus|NX': ['250', '350', '350h', '450h'],
  // Acura
  'Acura|Integra': ['Base', 'A-Spec', 'Type S'],
  'Acura|TLX': ['Base', 'Technology', 'A-Spec', 'Type S'],
  'Acura|RDX': ['Base', 'Technology', 'A-Spec', 'Advance'],
  'Acura|MDX': ['Base', 'Technology', 'A-Spec', 'Advance', 'Type S'],
  // Honda
  'Honda|Civic': ['LX', 'Sport', 'EX', 'EX-L', 'Sport Touring'],
  'Honda|Accord': ['LX', 'EX', 'EX-L', 'Sport', 'Sport-L', 'Touring'],
  'Honda|CR-V': ['LX', 'EX', 'EX-L', 'Sport', 'Sport Touring'],
  // Toyota
  'Toyota|Camry': ['LE', 'SE', 'XSE', 'XLE', 'TRD'],
  'Toyota|Corolla': ['L', 'LE', 'SE', 'XSE', 'XLE'],
  'Toyota|RAV4': ['LE', 'XLE', 'XLE Premium', 'Adventure', 'TRD Off-Road', 'Limited', 'Prime'],
  'Toyota|Highlander': ['L', 'LE', 'XLE', 'Limited', 'Platinum'],
  // Ford
  'Ford|Mustang': ['EcoBoost', 'GT', 'Mach 1', 'Shelby GT500', 'Dark Horse'],
  'Ford|F-150': ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Raptor'],
  'Ford|Explorer': ['Base', 'XLT', 'Limited', 'ST', 'Platinum'],
  // Chevrolet
  'Chevrolet|Silverado': ['WT', 'Custom', 'LT', 'RST', 'LTZ', 'High Country'],
  'Chevrolet|Equinox': ['LS', 'LT', 'RS', 'Premier'],
  'Chevrolet|Corvette': ['Stingray', 'Z06', 'E-Ray'],
  // Hyundai
  'Hyundai|Elantra': ['Essential', 'Preferred', 'Luxury', 'N Line', 'N'],
  'Hyundai|Tucson': ['Essential', 'Preferred', 'Luxury', 'N Line'],
  // Kia
  'Kia|Sportage': ['LX', 'EX', 'SX', 'X-Line'],
  'Kia|Sorento': ['LX', 'EX', 'SX', 'X-Line'],
  // Volkswagen
  'Volkswagen|Golf': ['Trendline', 'Comfortline', 'Highline'],
  'Volkswagen|Tiguan': ['Trendline', 'Comfortline', 'Highline', 'R-Line'],
  // Porsche
  'Porsche|911': ['Carrera', 'Carrera S', 'Carrera 4', 'Carrera 4S', 'GT3', 'Turbo', 'Turbo S'],
  'Porsche|Cayenne': ['Base', 'S', 'E-Hybrid', 'Coupe', 'Turbo', 'Turbo GT'],
  // Genesis
  'Genesis|G80': ['2.5T', '2.5T AWD', '3.5T', '3.5T AWD'],
  'Genesis|GV70': ['2.5T', '2.5T AWD', '3.5T AWD'],
}

/** Get models for a given make. Returns empty array if make not found. */
export function getModelsForMake(make: string): string[] {
  return VEHICLE_MODELS_BY_MAKE_CA[make] ?? []
}

/** Get trims for a given make and model. Returns empty array if none. */
export function getTrimsForModel(make: string, model: string): string[] {
  const key = `${make}|${model}`
  return VEHICLE_TRIMS_BY_MAKE_MODEL[key] ?? []
}
