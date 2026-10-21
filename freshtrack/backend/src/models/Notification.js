const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'shelf_life_warning',
      'inspection_needed',
      'freshness_declining',
      'spoilage_recorded',
      'batch_expired',
      'missing_inspection'
    ],
    required: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['critical', 'warning', 'info'],
    default: 'info'
  },
  read: { type: Boolean, default: false },
  resolved: { type: Boolean, default: false },
  resolved_at: Date,
  dedup_key: { type: String, index: true }
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
