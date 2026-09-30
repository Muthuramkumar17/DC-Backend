const express = require('express');
const router = express.Router();

const visitController = require('../controllers/visitController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, visitController.getAllVisits);
router.get('/:id', authMiddleware, visitController.getVisitById);
router.patch('/:id', authMiddleware, visitController.updateVisit);

module.exports = router;