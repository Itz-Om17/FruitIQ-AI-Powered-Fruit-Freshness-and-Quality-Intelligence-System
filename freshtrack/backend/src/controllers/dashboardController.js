const Batch = require('../models/Batch');
const Inspection = require('../models/Inspection');
const StockMovement = require('../models/StockMovement');
const Notification = require('../models/Notification');

/**
 * GET /api/dashboard
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.userId;

    // --- Summary Metrics ---
    const [
      totalBatches,
      activeBatches,
      totalInspections,
      urgentBatches,
      recentInspections,
      allActiveBatches
    ] = await Promise.all([
      Batch.countDocuments({ user: userId }),
      Batch.countDocuments({ user: userId, status: { $in: ['active', 'low_stock'] } }),
      Inspection.countDocuments({ user: userId }),
      Batch.countDocuments({ user: userId, 'priority.level': 'urgent', status: 'active' }),
      Inspection.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('scan_id summary status createdAt image_path'),
      Batch.find({ user: userId, status: { $in: ['active', 'low_stock'] } })
        .sort({ 'priority.score': -1 })
    ]);

    // Calculate aggregate metrics from active batches
    let totalQuantity = 0;
    let totalSpoiled = 0;
    let totalValueAtRisk = 0;
    let expiringCount = 0;
    const fruitDistribution = {};
    const freshnessDistribution = { FRESH: 0, 'SEMI-FRESH': 0, ROTTEN: 0, NOT_INSPECTED: 0 };

    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    for (const b of allActiveBatches) {
      const remaining = b.remaining_quantity;
      totalQuantity += remaining;
      totalSpoiled += b.spoiled_quantity;

      // Value at risk (batches with < 3 days shelf life)
      if (b.shelf_life?.estimated_expiry) {
        const diff = b.shelf_life.estimated_expiry - now;
        if (diff < threeDays && diff > 0) {
          expiringCount++;
          if (b.purchase_cost?.amount) {
            totalValueAtRisk += (remaining / b.quantity) * b.purchase_cost.amount;
          }
        }
      }

      // Fruit type distribution
      const ft = b.fruit_type || 'Unknown';
      fruitDistribution[ft] = (fruitDistribution[ft] || 0) + remaining;

      // Freshness distribution
      const state = b.freshness?.state || 'NOT_INSPECTED';
      freshnessDistribution[state] = (freshnessDistribution[state] || 0) + 1;
    }

    // Priority stock (top 10 by priority score descending)
    const priorityStock = allActiveBatches
      .filter(b => b.remaining_quantity > 0)
      .sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0))
      .slice(0, 10)
      .map(b => ({
        _id: b._id,
        batch_code: b.batch_code,
        fruit_type: b.fruit_type,
        quantity: b.remaining_quantity,
        unit: b.unit,
        freshness_state: b.freshness?.state,
        avg_freshness_pct: b.freshness?.avg_freshness_pct,
        remaining_shelf_life_days: b.remaining_shelf_life_days,
        priority: b.priority,
        status: b.status
      }));

    // Spoilage over time (last 30 days)
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const spoilageMovements = await StockMovement.aggregate([
      {
        $match: {
          user: userId,
          type: 'spoiled',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$quantity' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Unread notifications count
    const unreadNotifications = await Notification.countDocuments({
      user: userId,
      read: false
    });

    res.json({
      metrics: {
        total_batches: totalBatches,
        active_batches: activeBatches,
        total_quantity: Math.round(totalQuantity * 100) / 100,
        total_inspections: totalInspections,
        urgent_batches: urgentBatches,
        expiring_batches: expiringCount,
        total_spoiled: Math.round(totalSpoiled * 100) / 100,
        value_at_risk: Math.round(totalValueAtRisk * 100) / 100,
        unread_notifications: unreadNotifications
      },
      fruit_distribution: Object.entries(fruitDistribution).map(([name, qty]) => ({
        name, quantity: qty
      })),
      freshness_distribution: Object.entries(freshnessDistribution).map(([state, count]) => ({
        state, count
      })),
      priority_stock: priorityStock,
      recent_inspections: recentInspections,
      spoilage_trend: spoilageMovements.map(s => ({
        date: s._id,
        quantity: s.total
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/reports
 * CSV-exportable reports
 */
exports.getReports = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { type, start_date, end_date, fruit_type, format: fmt } = req.query;

    const dateFilter = {};
    if (start_date) dateFilter.$gte = new Date(start_date);
    if (end_date) dateFilter.$lte = new Date(end_date);

    let data;

    switch (type) {
      case 'inventory': {
        const filter = { user: userId, status: { $in: ['active', 'low_stock'] } };
        if (fruit_type) filter.fruit_type = new RegExp(fruit_type, 'i');
        data = await Batch.find(filter).sort({ createdAt: -1 });
        break;
      }
      case 'inspections': {
        const filter = { user: userId };
        if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
        data = await Inspection.find(filter).sort({ createdAt: -1 }).limit(500);
        break;
      }
      case 'spoilage': {
        const filter = { user: userId, type: 'spoiled' };
        if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
        data = await StockMovement.find(filter)
          .sort({ createdAt: -1 })
          .populate('batch', 'batch_code fruit_type');
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid report type. Use: inventory, inspections, spoilage' });
    }

    // CSV export
    if (fmt === 'csv') {
      if (!data.length) {
        return res.status(200).send('No data');
      }
      const fields = Object.keys(data[0].toObject()).filter(k => !['__v', 'user'].includes(k));
      const header = fields.join(',');
      const rows = data.map(item => {
        const obj = item.toObject();
        return fields.map(f => {
          const v = obj[f];
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
          return `"${String(v).replace(/"/g, '""')}"`;
        }).join(',');
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=freshtrack-${type}-${Date.now()}.csv`);
      return res.send([header, ...rows].join('\n'));
    }

    res.json({ report_type: type, count: data.length, data });
  } catch (err) {
    next(err);
  }
};
