const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Inspection = require('../models/Inspection');
const Batch = require('../models/Batch');
const { calculatePriority } = require('../services/prioritizationService');
const { triggerBatchNotifications } = require('../services/notificationService');

const INFERENCE_URL = process.env.INFERENCE_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * POST /api/inspections/scan
 * Upload image → call inference service → save inspection record
 */
exports.scanImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const filePath = req.file.path;
    const conf = parseFloat(req.body.conf) || 0.35;
    const iou = parseFloat(req.body.iou) || 0.45;

    // Call FastAPI inference service
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    let inferenceResult;
    try {
      const response = await axios.post(
        `${INFERENCE_URL}/api/v1/inspect?conf=${conf}&iou=${iou}`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 120000,
          maxContentLength: 50 * 1024 * 1024
        }
      );
      inferenceResult = response.data;
    } catch (apiErr) {
      const msg = apiErr.response?.data?.detail || apiErr.message;
      return res.status(502).json({
        error: 'Inference service error',
        detail: msg
      });
    }

    // Flag low-confidence detections for manual review
    const detections = (inferenceResult.detections || []).map(d => ({
      ...d,
      needs_manual_review: d.keras_food_conf < 0.5 || d.freshness_score_pct === undefined
    }));

    // Determine status
    let status = 'completed';
    if (inferenceResult.status === 'no_detections') {
      status = 'no_detections';
    } else if (detections.some(d => d.needs_manual_review)) {
      status = 'pending_review';
    }

    // Save to DB
    const inspection = await Inspection.create({
      user: req.userId,
      scan_id: inferenceResult.scan_id,
      image_path: filePath.replace(/\\/g, '/'),
      image_size: inferenceResult.image_size,
      timing_ms: inferenceResult.timing_ms,
      detections,
      summary: inferenceResult.summary || { total: 0, fresh: 0, semi_fresh: 0, rotten: 0, avg_freshness_pct: 0 },
      status,
      notes: req.body.notes || ''
    });

    res.status(201).json({
      inspection,
      message: status === 'no_detections'
        ? 'No fruits were detected in this image. Try a clearer image with visible fruits.'
        : `Detected ${inspection.summary.total} fruit(s) with ${inspection.summary.avg_freshness_pct}% average freshness.`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inspections
 * List inspections with pagination
 */
exports.getInspections = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { user: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.batch) filter.batch = req.query.batch;

    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('batch', 'batch_code fruit_type'),
      Inspection.countDocuments(filter)
    ]);

    res.json({
      inspections,
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inspections/:id
 */
exports.getInspection = async (req, res, next) => {
  try {
    const inspection = await Inspection.findOne({
      _id: req.params.id,
      user: req.userId
    }).populate('batch', 'batch_code fruit_type');

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json({ inspection });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inspections/:id/commit
 * Commit inspection results to a batch
 */
exports.commitToBatch = async (req, res, next) => {
  try {
    const { batch_id } = req.body;
    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id is required' });
    }

    const inspection = await Inspection.findOne({
      _id: req.params.id,
      user: req.userId
    });
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    if (inspection.committed_to_inventory) {
      return res.status(409).json({ error: 'Inspection already committed to inventory' });
    }

    const batch = await Batch.findOne({ _id: batch_id, user: req.userId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Update batch freshness from inspection
    const avgShelfLife = inspection.detections.reduce(
      (sum, d) => sum + (d.shelf_life_days || 0), 0
    ) / (inspection.detections.length || 1);

    batch.freshness = {
      state: inspection.summary.avg_freshness_pct >= 70 ? 'FRESH'
        : inspection.summary.avg_freshness_pct >= 40 ? 'SEMI-FRESH' : 'ROTTEN',
      avg_freshness_pct: inspection.summary.avg_freshness_pct,
      last_inspection: inspection._id,
      last_inspection_date: new Date()
    };

    batch.shelf_life = {
      estimated_days: Math.round(avgShelfLife),
      estimated_expiry: new Date(Date.now() + avgShelfLife * 24 * 60 * 60 * 1000),
      original_estimate_days: batch.shelf_life?.original_estimate_days || Math.round(avgShelfLife),
      prediction_date: new Date()
    };

    batch.inspections.push(inspection._id);
    batch.priority = calculatePriority(batch, req.user?.preferences);
    await batch.save();

    await triggerBatchNotifications(batch, req.user?.preferences);

    inspection.batch = batch._id;
    inspection.committed_to_inventory = true;
    await inspection.save();

    res.json({ inspection, batch, message: 'Inspection committed to batch successfully' });
  } catch (err) {
    next(err);
  }
};
