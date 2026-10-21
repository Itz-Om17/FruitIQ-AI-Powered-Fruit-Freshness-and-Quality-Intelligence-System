const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.post('/query', chatbotController.askFruitBot);

module.exports = router;
