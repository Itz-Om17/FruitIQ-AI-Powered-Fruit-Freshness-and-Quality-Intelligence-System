const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { user: req.userId };
    if (req.query.unread === 'true') filter.read = false;
    if (req.query.severity) filter.severity = req.query.severity;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('batch', 'batch_code fruit_type'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.userId, read: false })
    ]);

    res.json({
      notifications,
      unread_count: unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/mark-all-read
 */
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.userId, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/resolve
 */
exports.resolveNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { resolved: true, resolved_at: new Date(), read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
};
