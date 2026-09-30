const express = require('express');
const router = express.Router();
const subscriptionTypeController = require('../controllers/subscriptionTypeController');
const auth = require('../middleware/auth');

router.get('/', auth, subscriptionTypeController.getAllSubscriptionTypes);
router.get('/:id', auth, subscriptionTypeController.getSubscriptionTypeById);
router.post('/', auth, subscriptionTypeController.createSubscriptionType);
router.put('/:id', auth, subscriptionTypeController.updateSubscriptionType);
router.delete('/:id', auth, subscriptionTypeController.deleteSubscriptionType);

module.exports = router;
