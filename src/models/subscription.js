const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const subscriptionSchema = new mongoose.Schema(
  {
    subscriptionId: { type: String, required: true, unique: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    totalVisits: { type: Number, required: true, min: 1 },
    completedVisits: { type: Number, required: true, default: 0, min: 0 },
    remainingVisits: { type: Number, required: true, min: 0 },
    scheduleIntervalDays: { type: Number, required: true, min: 1 },
    subscriptionStatus: { type: String, required: true, default: 'Upcoming', index: true },
    bookingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    pricingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Pricing', required: true },
    serviceFrequencyReference: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceFrequency', required: true },
    subscriptionTypeReference: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionType', required: true },
    isPending: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

subscriptionSchema.pre('validate', function validateLifecycle(next) {
  if ([this.isPending, this.isCompleted, this.isCancelled].filter(Boolean).length !== 1) {
    return next(new Error('Exactly one subscription lifecycle state must be true'));
  }
  return next();
});

sequentialIdPlugin(subscriptionSchema, { field: 'subscriptionId', prefix: 'SUB' });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
