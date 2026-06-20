export const CONSTANTS = {
  HOURS_IN_DAY: 24,
  DEFAULT_PA_PLAN: 90,
  MAX_PHOTOS: 4,
  MAX_IMAGE_SIZE: 600,
  IMAGE_QUALITY: 0.5,
  LOG_LIMIT: 200,
  NOTIFICATION_DURATION: 4000,
};

export const STATUS_COLORS = {
  'border-blue-500': '#3B82F6',
  'border-red-500': '#EF4444',
  'border-yellow-500': '#F59E0B',
  'border-green-500': '#10B981',
};

export const EQUIPMENT_TYPES = ['Crusher', 'Ball Mill', 'Thickener', 'Furnace', 'Pump', 'Conveyor', 'Generator', 'Other'];
export const EQUIPMENT_STATUS = ['Active', 'In Maintenance', 'Idle', 'Decommissioned'];
export const CRITICALITY_LEVELS = ['High', 'Medium', 'Low'];
export const LOG_TYPES = ['PM', 'Repair', 'Inspection', 'Breakdown'];
export const LOG_STATUS = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

// Work Order Priority Levels
export const WO_PRIORITY = ['Emergency', 'Urgent', 'Normal', 'Planned'];

// Work Order Status Workflow
export const WO_STATUS = ['Draft', 'Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled'];

// Work Order Source/Department
export const WO_DEPARTMENTS = ['Production', 'Maintenance', 'Safety', 'Quality', 'Engineering', 'Operations', 'DTMF', 'MineGEO', 'GeoDEV', 'Mining', 'External', 'Other'];

// Work Order Priority Colors
export const WO_PRIORITY_COLORS = {
  'Emergency': '#EF4444',
  'Urgent': '#F97316', 
  'Normal': '#EAB308',
  'Planned': '#22C55E'
};

export const RCA_OPTIONS = ['PM', 'Human Error', 'Fatigue/Wear', 'External Factor', 'Design/Quality', 'Operational Misuse'];
export const BD_CATEGORIES = ['Mechanical', 'Electrical', 'Operational'];
export const PERFORMANCE_TYPES = ['Unscheduled', 'Scheduled'];

export const DEFAULT_EQUIP_FORM = () => ({
  id: '', nama: '', tipe: 'Crusher', lokasi: '', status: 'Active', sn: '',
  tglInstalasi: '', vendor: '', foto: '', nextPM: '', criticality: 'Medium'
});

export const DEFAULT_PART_FORM = () => ({
  id: '', nama: '', namaSingkat: '', partNumber: '', equipId: '', stok: 0, minStock: 0,
  lokasi: '', vendor: '', harga: 0, foto: '',
  lastReplaceDate: '', avgLifetimeDays: 365, usageHours: 0
});

export const DEFAULT_LOG_FORM = () => ({
  logId: '', type: 'PM', desc: '', downtime: 0, cost: 0, equipmentId: '',
  date: new Date().toISOString().split('T')[0], tech: 'Maintenance Team',
  parts: [], status: 'Pending', hm: '', catatan: '', photos: [], rca: 'PM',
  // Work Order Fields
  woPriority: 'Normal', woNumber: '', assignedTo: '', dueDate: '',
  estimatedHours: 0, actualHours: 0, laborCost: 0,
  // Department Request Fields
  requestSource: 'Production', requestedBy: '', requestDate: new Date().toISOString().split('T')[0],
  approvedBy: '', approvalDate: '',
  // External Fields
  externalEquipName: ''
});

export const DEFAULT_PERF_FORM = () => ({
  id: '', equipmentId: '', date: new Date().toISOString().split('T')[0],
  wh: "24.00", bd: "0.00", stb: "0.00", freq: 0, type: 'Unscheduled',
  area: '', paPlan: 90, remarks: '', rca: 'None', category: 'Mechanical', events: []
});