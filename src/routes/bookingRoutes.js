const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const timeSlotController = require('../controllers/timeSlotController');
const auth = require('../middleware/auth');

// Dynamic availability endpoint for bookings
router.get('/availability', auth, timeSlotController.getAvailableTimeSlots);
router.post('/availability', auth, timeSlotController.getAvailableTimeSlots);

router.post('/preview', auth, bookingController.previewBookingQuote);

router.get('/', auth, bookingController.getAllBookings);
router.patch('/:id/cancel', auth, bookingController.cancelBooking);
router.patch('/:id/restore', auth, bookingController.restoreBooking);
router.patch('/:id/complete', auth, bookingController.completeBooking);
router.patch('/:id', auth, bookingController.updateBookingPaymentAccount);
router.get('/:id', auth, bookingController.getBookingById);
router.post('/', auth, bookingController.createBooking);
router.delete('/:id', auth, bookingController.deleteBooking);

module.exports = router;