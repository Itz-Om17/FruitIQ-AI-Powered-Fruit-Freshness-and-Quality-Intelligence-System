/**
 * FreshTrack AI — Notification Service
 * Generates automated alerts for shelf-life expiry, inspection requirements,
 * freshness degradation, and spoilage events. Avoids duplicate unread alerts.
 */
const Notification = require('../models/Notification');

async function triggerBatchNotifications(batch, userPreferences = {}) {
  if (!batch || !batch.user) return;
  const userId = batch.user;
  const warningDays = userPreferences.shelfLifeWarningDays || 3;
  const inspectionIntervalDays = userPreferences.inspectionIntervalDays || 2;
  const remainingDays = batch.remaining_shelf_life_days;

  const alerts = [];

  // 1. Shelf-life expiration alert
  if (remainingDays !== null && remainingDays !== undefined) {
    if (remainingDays <= 0) {
      alerts.push({
        type: 'batch_expired',
        severity: 'critical',
        title: `Batch Expired: ${batch.batch_code} (${batch.fruit_type})`,
        message: `Batch ${batch.batch_code} has reached or exceeded its estimated shelf life. Physical inspection and action required.`,
        dedup_key: `expired_${batch._id}`
      });
    } else if (remainingDays <= warningDays) {
      alerts.push({
        type: 'shelf_life_warning',
        severity: remainingDays <= 1 ? 'critical' : 'warning',
        title: `Shelf Life Alert: ${batch.batch_code} (${batch.fruit_type})`,
        message: `Batch ${batch.batch_code} has only ${remainingDays} day(s) of estimated shelf life remaining. Prioritize for dispatch.`,
        dedup_key: `shelf_warn_${batch._id}_${remainingDays}`
      });
    }
  }

  // 2. Freshness state alert
  if (batch.freshness?.state === 'ROTTEN') {
    alerts.push({
      type: 'freshness_declining',
      severity: 'critical',
      title: `Critical Freshness Loss: ${batch.batch_code}`,
      message: `Inspection indicates fruit in batch ${batch.batch_code} is ROTTEN. Segregate immediately to prevent spread.`,
      dedup_key: `rotten_${batch._id}`
    });
  }

  // 3. Inspection needed
  if (!batch.freshness?.last_inspection_date) {
    alerts.push({
      type: 'missing_inspection',
      severity: 'info',
      title: `Inspection Required: ${batch.batch_code}`,
      message: `Batch ${batch.batch_code} (${batch.fruit_type}) has not been inspected yet. Run an AI scan to assess freshness.`,
      dedup_key: `no_inspect_${batch._id}`
    });
  } else {
    const daysSince = (Date.now() - new Date(batch.freshness.last_inspection_date)) / (1000 * 60 * 60 * 24);
    if (daysSince > inspectionIntervalDays * 2) {
      alerts.push({
        type: 'inspection_needed',
        severity: 'warning',
        title: `Inspection Overdue: ${batch.batch_code}`,
        message: `Last inspection was ${Math.round(daysSince)} days ago. A routine re-scan is recommended.`,
        dedup_key: `reinspect_${batch._id}`
      });
    }
  }

  // Process and save non-duplicate alerts
  for (const alert of alerts) {
    const existing = await Notification.findOne({
      user: userId,
      dedup_key: alert.dedup_key,
      resolved: false
    });

    if (!existing) {
      await Notification.create({
        user: userId,
        batch: batch._id,
        ...alert
      });
    }
  }
}

module.exports = {
  triggerBatchNotifications
};
