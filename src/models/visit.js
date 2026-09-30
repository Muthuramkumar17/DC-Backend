const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const visitSchema = new mongoose.Schema(
  {
    visitId: { type: String, required: true, unique: true },
    visitNumber: { type: Number, required: true, min: 1 },
    scheduledStartDateTime: { type: Date, required: true, index: true },
    scheduledEndDateTime: { type: Date, required: true, index: true },
    actualStartDateTime: { type: Date, default: null },
    actualEndDateTime: { type: Date, default: null },
    isPending: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    remarks: { type: String, default: '', trim: true },
    subscriptionReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    bookingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    timeSlotReference: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot', required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

visitSchema.pre('validate', function validateLifecycle(next) {
  const trueLifecycleStates = [
    this.isPending === true,
    this.isCompleted === true,
    this.isCancelled === true,
  ].filter(Boolean).length;

  if (trueLifecycleStates !== 1) {
    return next(new Error('Exactly one visit lifecycle state must be true'));
  }

  return next();
});

visitSchema.index({ subscriptionReference: 1, visitNumber: 1 }, { unique: true });

sequentialIdPlugin(visitSchema, { field: 'visitId', prefix: 'VIS' });

module.exports = mongoose.models.Visit || mongoose.model('Visit', visitSchema);
