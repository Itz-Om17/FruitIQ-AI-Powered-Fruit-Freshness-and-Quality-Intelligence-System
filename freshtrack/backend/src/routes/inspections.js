const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const inspectionController = require('../controllers/inspectionController');
const { auth } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter
});

router.use(auth);

router.post('/scan', upload.single('image'), inspectionController.scanImage);
router.get('/', inspectionController.getInspections);
router.get('/:id', inspectionController.getInspection);
router.post('/:id/commit', inspectionController.commitToBatch);

module.exports = router;
