const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const pricingSchema = new mongoose.Schema(
  {
    pricingId: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    effectiveFrom: { type: Date, default: Date.now },
    bathroomCountReference: { type: mongoose.Schema.Types.ObjectId, ref: 'BathroomCount', required: true },
    // Retained for documents created before the reference-field migration.
    bathroomCountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BathroomCount', select: false },
    serviceFrequencyReference: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceFrequency', required: true },
    subscriptionTypeReference: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionType', required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(pricingSchema, { field: 'pricingId', prefix: 'PRC' });

module.exports = mongoose.models.Pricing || mongoose.model('Pricing', pricingSchema);
