const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['incoming', 'sold', 'spoiled', 'adjustment', 'discard'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  quantity_before: { type: Number },
  quantity_after: { type: Number },
  reason: String,
  notes: String,
  inspection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  }
}, { timestamps: true });

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ batch: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
