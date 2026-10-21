export type FreshnessState = 'FRESH' | 'SEMI-FRESH' | 'ROTTEN' | 'UNKNOWN' | 'NOT_INSPECTED';

export type PriorityLevel = 'urgent' | 'sell_first' | 'monitor' | 'normal' | 'manual_review';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  detection_id: number;
  bounding_box: BoundingBox;
  yolo_class: string;
  yolo_confidence: number;
  keras_food_name: string;
  keras_food_raw: string;
  keras_food_conf: number;
  p_fresh: number;
  p_rotten: number;
  freshness_score_pct: number;
  freshness_state: FreshnessState;
  shelf_life_days: number;
  needs_manual_review?: boolean;
  manual_override?: {
    fruit_type?: string;
    freshness_state?: string;
    notes?: string;
  };
}

export interface InspectionSummary {
  total: number;
  fresh: number;
  semi_fresh: number;
  rotten: number;
  avg_freshness_pct: number;
}

export interface Inspection {
  _id: string;
  scan_id: string;
  image_path: string;
  image_size?: { width: number; height: number };
  timing_ms?: { yolo: number; keras: number; total: number };
  detections: Detection[];
  summary: InspectionSummary;
  status: 'completed' | 'failed' | 'no_detections' | 'pending_review';
  batch?: any;
  committed_to_inventory: boolean;
  notes?: string;
  createdAt: string;
}

export interface Batch {
  _id: string;
  batch_code: string;
  fruit_type: string;
  quantity: number;
  remaining_quantity?: number;
  remaining_shelf_life_days?: number | null;
  sold_quantity: number;
  spoiled_quantity: number;
  unit: string;
  purchase_date?: string;
  arrival_date: string;
  supplier?: {
    name?: string;
    contact?: string;
    location?: string;
  };
  purchase_cost?: {
    amount?: number;
    currency?: string;
  };
  storage_location?: string;
  storage_conditions?: {
    temperature?: string;
    humidity?: string;
    notes?: string;
  };
  freshness?: {
    state: FreshnessState;
    avg_freshness_pct: number;
    last_inspection?: string;
    last_inspection_date?: string;
  };
  shelf_life?: {
    estimated_days?: number;
    estimated_expiry?: string;
    original_estimate_days?: number;
    prediction_date?: string;
  };
  status: 'active' | 'low_stock' | 'expired' | 'sold_out' | 'archived';
  priority?: {
    level: PriorityLevel;
    reason?: string;
    score?: number;
    last_calculated?: string;
  };
  notes?: string;
  inspections?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  _id: string;
  batch: string | Batch;
  type: 'incoming' | 'sold' | 'spoiled' | 'adjustment' | 'discard';
  quantity: number;
  quantity_before?: number;
  quantity_after?: number;
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  read: boolean;
  resolved: boolean;
  batch?: { _id: string; batch_code: string; fruit_type: string };
  createdAt: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  company?: string;
  preferences?: {
    shelfLifeWarningDays?: number;
    inspectionIntervalDays?: number;
    dashboardRefreshMinutes?: number;
  };
}

export interface DashboardMetrics {
  total_batches: number;
  active_batches: number;
  total_quantity: number;
  total_inspections: number;
  urgent_batches: number;
  expiring_batches: number;
  total_spoiled: number;
  value_at_risk: number;
  unread_notifications: number;
}
