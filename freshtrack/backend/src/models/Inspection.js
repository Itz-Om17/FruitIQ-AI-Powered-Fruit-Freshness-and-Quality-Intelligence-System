const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  detection_id: Number,
  bounding_box: {
    x1: Number, y1: Number, x2: Number, y2: Number
  },
  yolo_class: String,
  yolo_confidence: Number,
  keras_food_name: String,
  keras_food_raw: String,
  keras_food_conf: Number,
  p_fresh: Number,
  p_rotten: Number,
  freshness_score_pct: Number,
  freshness_state: {
    type: String,
    enum: ['FRESH', 'SEMI-FRESH', 'ROTTEN', 'UNKNOWN']
  },
  shelf_life_days: Number,
  needs_manual_review: { type: Boolean, default: false },
  manual_override: {
    fruit_type: String,
    freshness_state: String,
    notes: String,
    overridden_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overridden_at: Date
  }
}, { _id: true });

const inspectionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  scan_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  image_path: { type: String, required: true },
  image_size: {
    width: Number,
    height: Number
  },
  timing_ms: {
    yolo: Number,
    keras: Number,
    total: Number
  },
  detections: [detectionSchema],
  summary: {
    total: { type: Number, default: 0 },
    fresh: { type: Number, default: 0 },
    semi_fresh: { type: Number, default: 0 },
    rotten: { type: Number, default: 0 },
    avg_freshness_pct: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'no_detections', 'pending_review'],
    default: 'completed'
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    index: true
  },
  committed_to_inventory: { type: Boolean, default: false },
  notes: String
}, { timestamps: true });

inspectionSchema.index({ createdAt: -1 });
inspectionSchema.index({ 'summary.avg_freshness_pct': 1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
