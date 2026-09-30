const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');

router.get('/', auth, subscriptionController.getAllSubscriptions);
router.get('/:id', auth, subscriptionController.getSubscriptionById);

module.exports = router;
