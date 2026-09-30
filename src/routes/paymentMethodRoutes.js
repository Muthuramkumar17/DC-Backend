const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const auth = require('../middleware/auth');

router.get('/', auth, paymentMethodController.getAllPaymentMethods);
router.get('/:id', auth, paymentMethodController.getPaymentMethodById);
router.post('/', auth, paymentMethodController.createPaymentMethod);
router.put('/:id', auth, paymentMethodController.updatePaymentMethod);
router.delete('/:id', auth, paymentMethodController.deletePaymentMethod);

module.exports = router;
