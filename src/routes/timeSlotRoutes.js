const express = require('express');
const router = express.Router();
const timeSlotController = require('../controllers/timeSlotController');
const auth = require('../middleware/auth');

// Dynamic availability calculation
router.get('/availability', auth, timeSlotController.getAvailableTimeSlots);
router.post('/availability', auth, timeSlotController.getAvailableTimeSlots);

router.get('/', auth, timeSlotController.getAllTimeSlots);
router.get('/:id', auth, timeSlotController.getTimeSlotById);
router.post('/', auth, timeSlotController.createTimeSlot);
router.put('/:id', auth, timeSlotController.updateTimeSlot);
router.delete('/:id', auth, timeSlotController.deleteTimeSlot);

module.exports = router;
