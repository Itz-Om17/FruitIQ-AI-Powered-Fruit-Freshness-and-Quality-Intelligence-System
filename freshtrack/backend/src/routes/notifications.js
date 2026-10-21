const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markRead);
router.post('/mark-all-read', notificationController.markAllRead);
router.patch('/:id/resolve', notificationController.resolveNotification);

module.exports = router;
