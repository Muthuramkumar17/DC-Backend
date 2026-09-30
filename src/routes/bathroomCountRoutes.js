const express = require('express');
const router = express.Router();
const bathroomCountController = require('../controllers/bathroomCountController');
const auth = require('../middleware/auth');

router.get('/', auth, bathroomCountController.getAllBathroomCounts);
router.get('/:id', auth, bathroomCountController.getBathroomCountById);
router.post('/', auth, bathroomCountController.createBathroomCount);
router.put('/:id', auth, bathroomCountController.updateBathroomCount);
router.delete('/:id', auth, bathroomCountController.deleteBathroomCount);

module.exports = router;
