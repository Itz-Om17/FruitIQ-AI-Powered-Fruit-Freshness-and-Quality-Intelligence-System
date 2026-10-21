const { v4: uuidv4 } = require('uuid');
const Batch = require('../models/Batch');
const StockMovement = require('../models/StockMovement');
const { calculatePriority } = require('../services/prioritizationService');
const { triggerBatchNotifications } = require('../services/notificationService');

/**
 * POST /api/batches
 */
exports.createBatch = async (req, res, next) => {
  try {
    const {
      fruit_type, quantity, unit, purchase_date, arrival_date,
      supplier, purchase_cost, storage_location, storage_conditions, notes
    } = req.body;

    if (!fruit_type || quantity === undefined) {
      return res.status(400).json({ error: 'fruit_type and quantity are required' });
    }

    const batch_code = `FT-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

    const batch = new Batch({
      user: req.userId,
      batch_code,
      fruit_type,
      quantity: Math.max(0, quantity),
      unit: unit || 'kg',
      purchase_date,
      arrival_date: arrival_date || new Date(),
      supplier,
      purchase_cost,
      storage_location,
      storage_conditions,
      notes
    });

    batch.priority = calculatePriority(batch, req.user?.preferences);
    await batch.save();

    // Trigger initial notification if needed
    await triggerBatchNotifications(batch, req.user?.preferences);

    // Record incoming stock movement
    await StockMovement.create({
      user: req.userId,
      batch: batch._id,
      type: 'incoming',
      quantity: batch.quantity,
      quantity_before: 0,
      quantity_after: batch.quantity,
      reason: 'Initial batch creation'
    });

    res.status(201).json({ batch });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/batches
 */
exports.getBatches = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { user: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.fruit_type) filter.fruit_type = new RegExp(req.query.fruit_type, 'i');
    if (req.query.priority) filter['priority.level'] = req.query.priority;

    const sort = {};
    if (req.query.sort === 'priority') {
      sort['priority.score'] = -1;
    } else if (req.query.sort === 'shelf_life') {
      sort['shelf_life.estimated_expiry'] = 1;
    } else {
      sort.createdAt = -1;
    }

    const [batches, total] = await Promise.all([
      Batch.find(filter).sort(sort).skip(skip).limit(limit),
      Batch.countDocuments(filter)
    ]);

    res.json({
      batches,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/batches/:id
 */
exports.getBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.id,
      user: req.userId
    }).populate('inspections');

    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/batches/:id
 */
exports.updateBatch = async (req, res, next) => {
  try {
    const allowed = [
      'fruit_type', 'unit', 'purchase_date', 'arrival_date',
      'supplier', 'purchase_cost', 'storage_location', 'storage_conditions',
      'notes', 'status'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const batch = await Batch.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/batches/:id/stock-movement
 */
exports.recordStockMovement = async (req, res, next) => {
  try {
    const { type, quantity, reason, notes } = req.body;
    if (!type || quantity === undefined) {
      return res.status(400).json({ error: 'type and quantity are required' });
    }

    const batch = await Batch.findOne({ _id: req.params.id, user: req.userId });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const qtyBefore = batch.quantity;
    let qtyAfter = qtyBefore;

    switch (type) {
      case 'incoming':
        qtyAfter = qtyBefore + Math.abs(quantity);
        batch.quantity = qtyAfter;
        break;
      case 'sold':
        if (quantity > batch.remaining_quantity) {
          return res.status(400).json({ error: 'Cannot sell more than remaining quantity' });
        }
        batch.sold_quantity += Math.abs(quantity);
        qtyAfter = batch.quantity;
        break;
      case 'spoiled':
      case 'discard':
        if (quantity > batch.remaining_quantity) {
          return res.status(400).json({ error: 'Cannot spoil more than remaining quantity' });
        }
        batch.spoiled_quantity += Math.abs(quantity);
        qtyAfter = batch.quantity;
        break;
      case 'adjustment':
        qtyAfter = Math.max(0, qtyBefore + quantity);
        batch.quantity = qtyAfter;
        break;
      default:
        return res.status(400).json({ error: 'Invalid movement type' });
    }

    // Update batch status
    const remaining = batch.remaining_quantity;
    if (remaining <= 0) {
      batch.status = type === 'sold' ? 'sold_out' : 'expired';
    } else if (remaining < qtyBefore * 0.2) {
      batch.status = 'low_stock';
    }

    await batch.save();

    const movement = await StockMovement.create({
      user: req.userId,
      batch: batch._id,
      type,
      quantity: Math.abs(quantity),
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason,
      notes
    });

    res.status(201).json({ movement, batch });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/batches/:id/movements
 */
exports.getMovements = async (req, res, next) => {
  try {
    const movements = await StockMovement.find({
      batch: req.params.id,
      user: req.userId
    }).sort({ createdAt: -1 });

    res.json({ movements });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/batches/:id/archive
 */
exports.archiveBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { status: 'archived' },
      { new: true }
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch, message: 'Batch archived' });
  } catch (err) {
    next(err);
  }
};
