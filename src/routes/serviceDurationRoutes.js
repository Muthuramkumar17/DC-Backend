const express = require('express');
const router = express.Router();
const serviceDurationController = require('../controllers/serviceDurationController');
const auth = require('../middleware/auth');

router.get('/', auth, serviceDurationController.getAllServiceDurations);
router.get('/:id', auth, serviceDurationController.getServiceDurationById);
router.post('/', auth, serviceDurationController.createServiceDuration);
router.put('/:id', auth, serviceDurationController.updateServiceDuration);
router.delete('/:id', auth, serviceDurationController.deleteServiceDuration);

module.exports = router;
