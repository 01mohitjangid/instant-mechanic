/**
 * Static reference data used to build realistic Indian-market seed data.
 * Nothing here touches the database — it is pure data.
 */

export interface ServiceSeed {
  name: string;
  category: string;
  description: string;
  basePrice: number;
  durationMinutes: number;
}

/** 18 services across 7 categories, priced in INR. */
export const SERVICES: readonly ServiceSeed[] = [
  {
    name: 'Basic Periodic Service',
    category: 'Periodic Maintenance',
    description: 'Engine oil, oil filter, top-ups and a 25-point health check.',
    basePrice: 2899,
    durationMinutes: 120,
  },
  {
    name: 'Comprehensive Periodic Service',
    category: 'Periodic Maintenance',
    description: 'Full service with air, fuel and cabin filters plus spark plugs.',
    basePrice: 5499,
    durationMinutes: 210,
  },
  {
    name: 'Engine Oil Change',
    category: 'Periodic Maintenance',
    description: 'Synthetic engine oil and filter replacement at your doorstep.',
    basePrice: 1899,
    durationMinutes: 60,
  },
  {
    name: 'Brake Pad Replacement',
    category: 'Repairs',
    description: 'Front or rear brake pad replacement with rotor inspection.',
    basePrice: 3499,
    durationMinutes: 90,
  },
  {
    name: 'Clutch Repair',
    category: 'Repairs',
    description: 'Clutch plate, pressure plate and release bearing replacement.',
    basePrice: 11500,
    durationMinutes: 300,
  },
  {
    name: 'Suspension Repair',
    category: 'Repairs',
    description: 'Shock absorber, strut and bush replacement.',
    basePrice: 7200,
    durationMinutes: 240,
  },
  {
    name: 'Radiator & Coolant Service',
    category: 'Repairs',
    description: 'Coolant flush, radiator leak check and hose replacement.',
    basePrice: 2650,
    durationMinutes: 90,
  },
  {
    name: 'Battery Replacement',
    category: 'Battery & Electrical',
    description: 'New battery fitted on site with old battery buy-back.',
    basePrice: 4999,
    durationMinutes: 45,
  },
  {
    name: 'Alternator Repair',
    category: 'Battery & Electrical',
    description: 'Alternator testing, brush replacement or full rebuild.',
    basePrice: 6400,
    durationMinutes: 180,
  },
  {
    name: 'Headlight & Wiring Fix',
    category: 'Battery & Electrical',
    description: 'Lighting, fuse and wiring harness fault repair.',
    basePrice: 1750,
    durationMinutes: 75,
  },
  {
    name: 'Tyre Replacement',
    category: 'Tyres & Wheels',
    description: 'Tyre fitting, valve replacement and disposal of the old tyre.',
    basePrice: 5200,
    durationMinutes: 60,
  },
  {
    name: 'Wheel Alignment & Balancing',
    category: 'Tyres & Wheels',
    description: 'Computerised four-wheel alignment and balancing.',
    basePrice: 1499,
    durationMinutes: 75,
  },
  {
    name: 'AC Gas Refill',
    category: 'AC Service',
    description: 'AC gas top-up with leak test and performance check.',
    basePrice: 2999,
    durationMinutes: 90,
  },
  {
    name: 'AC Cooling Coil Cleaning',
    category: 'AC Service',
    description: 'Evaporator coil cleaning, blower service and filter change.',
    basePrice: 4300,
    durationMinutes: 150,
  },
  {
    name: 'Engine Diagnostics (OBD Scan)',
    category: 'Diagnostics',
    description: 'Full OBD-II scan with fault code report and advice.',
    basePrice: 999,
    durationMinutes: 45,
  },
  {
    name: 'Roadside Breakdown Assistance',
    category: 'Roadside Assistance',
    description: 'Emergency on-spot repair for a vehicle stuck on the road.',
    basePrice: 1599,
    durationMinutes: 60,
  },
  {
    name: 'Jump Start & Battery Boost',
    category: 'Roadside Assistance',
    description: 'On-site jump start for a car that will not crank.',
    basePrice: 799,
    durationMinutes: 30,
  },
  {
    name: 'Interior Deep Cleaning',
    category: 'Detailing',
    description: 'Seat shampoo, dashboard polish and full interior vacuum.',
    basePrice: 3899,
    durationMinutes: 180,
  },
];

export interface CitySeed {
  name: string;
  stateCode: string;
  rtoCode: string;
  latitude: number;
  longitude: number;
}

export const CITIES: readonly CitySeed[] = [
  { name: 'Bengaluru', stateCode: 'KA', rtoCode: 'KA01', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Mumbai', stateCode: 'MH', rtoCode: 'MH02', latitude: 19.076, longitude: 72.8777 },
  { name: 'Delhi', stateCode: 'DL', rtoCode: 'DL03', latitude: 28.6139, longitude: 77.209 },
  { name: 'Pune', stateCode: 'MH', rtoCode: 'MH12', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Hyderabad', stateCode: 'TS', rtoCode: 'TS09', latitude: 17.385, longitude: 78.4867 },
  { name: 'Chennai', stateCode: 'TN', rtoCode: 'TN10', latitude: 13.0827, longitude: 80.2707 },
  { name: 'Gurugram', stateCode: 'HR', rtoCode: 'HR26', latitude: 28.4595, longitude: 77.0266 },
  { name: 'Noida', stateCode: 'UP', rtoCode: 'UP16', latitude: 28.5355, longitude: 77.391 },
  { name: 'Ahmedabad', stateCode: 'GJ', rtoCode: 'GJ01', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Jaipur', stateCode: 'RJ', rtoCode: 'RJ14', latitude: 26.9124, longitude: 75.7873 },
];

export const FIRST_NAMES: readonly string[] = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Rohan',
  'Karthik',
  'Ishaan',
  'Rahul',
  'Siddharth',
  'Ananya',
  'Diya',
  'Meera',
  'Priya',
  'Sneha',
  'Kavya',
  'Nisha',
  'Riya',
  'Manish',
  'Sunil',
  'Deepak',
  'Arjun',
  'Nikhil',
  'Varun',
  'Harsh',
  'Yash',
  'Pooja',
  'Shreya',
  'Neha',
  'Divya',
  'Anjali',
  'Swati',
  'Ritika',
  'Tanvi',
  'Imran',
  'Faisal',
  'Zoya',
  'Sana',
  'Joseph',
  'Maria',
  'Gurpreet',
  'Simran',
];

export const LAST_NAMES: readonly string[] = [
  'Sharma',
  'Verma',
  'Patel',
  'Reddy',
  'Iyer',
  'Nair',
  'Menon',
  'Gupta',
  'Singh',
  'Kumar',
  'Joshi',
  'Desai',
  'Chopra',
  'Malhotra',
  'Bose',
  'Ghosh',
  'Rao',
  'Naidu',
  'Pillai',
  'Shetty',
  'Kulkarni',
  'Deshpande',
  'Bhatia',
  'Kapoor',
  'Ansari',
  'Khan',
  'Sheikh',
  'Fernandes',
  'D’Souza',
  'Chauhan',
];

export interface VehicleModelSeed {
  make: string;
  model: string;
  fuelTypes: readonly string[];
}

export const VEHICLE_MODELS: readonly VehicleModelSeed[] = [
  { make: 'Maruti Suzuki', model: 'Swift', fuelTypes: ['Petrol', 'CNG'] },
  { make: 'Maruti Suzuki', model: 'Baleno', fuelTypes: ['Petrol'] },
  { make: 'Maruti Suzuki', model: 'Brezza', fuelTypes: ['Petrol', 'CNG'] },
  { make: 'Hyundai', model: 'i20', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'Hyundai', model: 'Creta', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'Hyundai', model: 'Venue', fuelTypes: ['Petrol'] },
  { make: 'Tata', model: 'Nexon', fuelTypes: ['Petrol', 'Diesel', 'Electric'] },
  { make: 'Tata', model: 'Punch', fuelTypes: ['Petrol', 'CNG'] },
  { make: 'Tata', model: 'Harrier', fuelTypes: ['Diesel'] },
  { make: 'Mahindra', model: 'XUV700', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'Mahindra', model: 'Scorpio-N', fuelTypes: ['Diesel'] },
  { make: 'Honda', model: 'City', fuelTypes: ['Petrol', 'Hybrid'] },
  { make: 'Honda', model: 'Amaze', fuelTypes: ['Petrol'] },
  { make: 'Toyota', model: 'Innova Crysta', fuelTypes: ['Diesel'] },
  { make: 'Toyota', model: 'Glanza', fuelTypes: ['Petrol'] },
  { make: 'Kia', model: 'Seltos', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'Kia', model: 'Sonet', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'MG', model: 'Hector', fuelTypes: ['Petrol', 'Diesel'] },
  { make: 'Volkswagen', model: 'Virtus', fuelTypes: ['Petrol'] },
  { make: 'Skoda', model: 'Slavia', fuelTypes: ['Petrol'] },
  { make: 'Renault', model: 'Kwid', fuelTypes: ['Petrol'] },
  { make: 'Nissan', model: 'Magnite', fuelTypes: ['Petrol'] },
];

export const SPECIALIZATIONS: readonly string[] = [
  'Engine & Transmission',
  'Brakes & Suspension',
  'Auto Electricals',
  'Air Conditioning',
  'Tyres & Wheel Care',
  'Diagnostics & ECU',
  'General Servicing',
  'EV Systems',
];

export const CANCELLATION_REASONS: readonly string[] = [
  'Customer rescheduled to a later date',
  'Customer was not reachable at the pickup time',
  'No mechanic available in the service area',
  'Spare part out of stock',
  'Duplicate booking created by the customer',
  'Customer chose a nearby workshop instead',
  'Vehicle was already repaired elsewhere',
];

export const BOOKING_NOTES: readonly string[] = [
  'Customer reported a rattling noise near the front-left wheel.',
  'Please call 15 minutes before arriving at the gate.',
  'Vehicle parked in basement level 2, pillar B4.',
  'Warning light on the dashboard since yesterday morning.',
  'Car pulls to the left while braking at high speed.',
  'AC cools only when the car is moving.',
  'Requested pickup and drop.',
  'Repeat visit — same complaint as the previous booking.',
];
