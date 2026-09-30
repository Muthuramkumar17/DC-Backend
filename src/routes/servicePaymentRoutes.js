const express = require('express');
const router = express.Router();
const controller = require('../controllers/servicePaymentController');
const auth = require('../middleware/auth');
router.get('/', auth, controller.getAllServicePayments);
router.get('/:id', auth, controller.getServicePaymentById);
router.put('/:id', auth, controller.updateServicePayment);
module.exports = router;
