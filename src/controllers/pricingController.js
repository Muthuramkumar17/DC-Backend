const Pricing = require('../models/pricing');
const AuditLog = require('../models/auditLog');
const PricingLog = require('../models/AuditLog');

//createPricing
exports.createPricing = async (req, res) => {
  try {
    const {
      bathroomCountReference,
      serviceFrequencyReference,
      subscriptionTypeReference,
      price,
      effectiveFrom,
      isActive,
      deactivatePrevious,
    } = req.body;

    if (!bathroomCountReference || !serviceFrequencyReference || !subscriptionTypeReference || price === undefined) {
      return res.status(400).json({
        message: 'bathroomCountReference, serviceFrequencyReference, subscriptionTypeReference, and price are required',
      });
    }

    // If updating price by creating a new row, optionally deactivate previous active row
    if (deactivatePrevious) {
      await Pricing.updateMany(
        {
        bathroomCountReference,
        serviceFrequencyReference,
        subscriptionTypeReference,
          isActive: true,
        },
        { isActive: false }
      );
    }

    const pricing = new Pricing({ pricingId: await Pricing.getNextSequentialId(),
      bathroomCountReference,
      serviceFrequencyReference,
      subscriptionTypeReference,
      price,
      isActive: isActive !== undefined ? isActive : true,
      effectiveFrom: effectiveFrom || new Date(),
      createdBy: req.user ? req.user.userId : null,
    });

    const savedPricing = await pricing.save();

    await PricingLog.create({
      operation: 'CREATE',
      actionBy: req.user ? req.user.userId : null,
      pricingId: savedPricing._id,
      details: { action: 'Pricing created' },
      newValue: savedPricing.toObject(),
    });

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'create',
      collectionName: 'pricing',
      recordId: savedPricing._id,
    });

    res.status(201).json(savedPricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllPricing
exports.getAllPricing = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const pricings = await Pricing.find(filter).select('+bathroomCountId')
      .populate('bathroomCountReference')
      .populate('bathroomCountId')
      .populate('serviceFrequencyReference')
      .populate('subscriptionTypeReference')
      .sort({ createdAt: -1 });

    res.status(200).json(pricings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getPricingById
exports.getPricingById = async (req, res) => {
  try {
    const pricing = await Pricing.findById(req.params.id).select('+bathroomCountId')
      .populate('bathroomCountReference')
      .populate('bathroomCountId')
      .populate('serviceFrequencyReference')
      .populate('subscriptionTypeReference');

    if (!pricing) {
      return res.status(404).json({ message: 'Pricing record not found' });
    }
    res.status(200).json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updatePricing
exports.updatePricing = async (req, res) => {
  try {
    const previousPricing = await Pricing.findById(req.params.id);
    if (!previousPricing) {
      return res.status(404).json({ message: 'Pricing record not found' });
    }

    const pricing = await Pricing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('bathroomCountReference')
      .populate('serviceFrequencyReference')
      .populate('subscriptionTypeReference');

    if (!pricing) {
      return res.status(404).json({ message: 'Pricing record not found' });
    }

    await PricingLog.create({
      operation: 'UPDATE',
      actionBy: req.user ? req.user.userId : null,
      pricingId: pricing._id,
      details: { action: 'Pricing updated', updatedFields: Object.keys(req.body) },
      previousValue: previousPricing.toObject(),
      newValue: pricing.toObject(),
    });

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'update',
      collectionName: 'pricing',
      recordId: pricing._id,
    });

    res.status(200).json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deletePricing
exports.deletePricing = async (req, res) => {
  try {
    const pricing = await Pricing.findByIdAndDelete(req.params.id);
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing record not found' });
    }

    await PricingLog.create({
      operation: 'DELETE',
      actionBy: req.user ? req.user.userId : null,
      pricingId: pricing._id,
      details: { action: 'Pricing deleted' },
      previousValue: pricing.toObject(),
    });

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'delete',
      collectionName: 'pricing',
      recordId: pricing._id,
    });

    res.status(200).json({ message: 'Pricing record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
