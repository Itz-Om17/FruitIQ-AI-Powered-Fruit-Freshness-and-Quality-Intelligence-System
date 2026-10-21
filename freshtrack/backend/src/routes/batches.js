const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.post('/', batchController.createBatch);
router.get('/', batchController.getBatches);
router.get('/:id', batchController.getBatch);
router.patch('/:id', batchController.updateBatch);
router.post('/:id/stock-movement', batchController.recordStockMovement);
router.get('/:id/movements', batchController.getMovements);
router.post('/:id/archive', batchController.archiveBatch);

module.exports = router;
