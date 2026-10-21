const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  batch_code: {
    type: String,
    required: true,
    unique: true
  },
  fruit_type: {
    type: String,
    required: [true, 'Fruit type is required'],
    trim: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    enum: ['kg', 'lb', 'pieces', 'crates', 'boxes'],
    default: 'kg'
  },
  purchase_date: { type: Date },
  arrival_date: { type: Date, default: Date.now },
  supplier: {
    name: String,
    contact: String,
    location: String
  },
  purchase_cost: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' }
  },
  storage_location: { type: String, trim: true },
  storage_conditions: {
    temperature: String,
    humidity: String,
    notes: String
  },
  // Latest freshness data (updated when inspection committed)
  freshness: {
    state: {
      type: String,
      enum: ['FRESH', 'SEMI-FRESH', 'ROTTEN', 'UNKNOWN', 'NOT_INSPECTED'],
      default: 'NOT_INSPECTED'
    },
    avg_freshness_pct: { type: Number, default: 0 },
    last_inspection: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection' },
    last_inspection_date: Date
  },
  shelf_life: {
    estimated_days: Number,
    estimated_expiry: Date,
    original_estimate_days: Number,
    prediction_date: Date
  },
  status: {
    type: String,
    enum: ['active', 'low_stock', 'expired', 'sold_out', 'archived'],
    default: 'active',
    index: true
  },
  priority: {
    level: {
      type: String,
      enum: ['urgent', 'sell_first', 'monitor', 'normal', 'manual_review'],
      default: 'normal'
    },
    reason: String,
    score: { type: Number, default: 50 },
    last_calculated: Date
  },
  spoiled_quantity: { type: Number, default: 0, min: 0 },
  sold_quantity: { type: Number, default: 0, min: 0 },
  notes: String,
  inspections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  }]
}, { timestamps: true });

batchSchema.index({ status: 1, 'priority.score': -1 });
batchSchema.index({ 'shelf_life.estimated_expiry': 1 });
batchSchema.index({ createdAt: -1 });

// Virtual: remaining quantity
batchSchema.virtual('remaining_quantity').get(function() {
  return Math.max(0, this.quantity - this.sold_quantity - this.spoiled_quantity);
});

// Virtual: remaining shelf life in days
batchSchema.virtual('remaining_shelf_life_days').get(function() {
  if (!this.shelf_life?.estimated_expiry) return null;
  const now = new Date();
  const diff = this.shelf_life.estimated_expiry - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

batchSchema.set('toJSON', { virtuals: true });
batchSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Batch', batchSchema);
