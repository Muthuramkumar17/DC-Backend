const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const subscriptionTypeSchema = new mongoose.Schema(
  {
    subscriptionTypeId: { type: String, required: true, unique: true },
    subscriptionName: { type: String, required: true, trim: true },
    timeGap: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(subscriptionTypeSchema, { field: 'subscriptionTypeId', prefix: 'SUB' });

module.exports = mongoose.models.SubscriptionType || mongoose.model('SubscriptionType', subscriptionTypeSchema);
