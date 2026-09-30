const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    scheduledDate: { type: Date, required: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    transactionId: { type: String, trim: true, maxlength: [200, 'transactionId is too long'], default: '' },
    amount: { type: Number, required: true, min: 0, validate: Number.isFinite },
    completionPhoto: { type: String, default: null },
    customerReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    bathroomCountReference: { type: mongoose.Schema.Types.ObjectId, ref: 'BathroomCount', default: null },
    pricingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Pricing', default: null },
    serviceDurationReference: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDuration', default: null },
    serviceFrequencyReference: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceFrequency', default: null },
    subscriptionTypeReference: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionType', default: null },
    timeSlotReference: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot', required: true },
    paymentMethodReference: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
    paymentAccountReference: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount', default: null },
    isPending: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function validateLifecycle(next) {
  if (!(this.scheduledDate instanceof Date) || Number.isNaN(this.scheduledDate.getTime())) {
    return next(new Error('scheduledDate must be a valid date'));
  }
  if (!(this.startDateTime instanceof Date) || Number.isNaN(this.startDateTime.getTime())) {
    return next(new Error('startDateTime must be a valid date'));
  }
  if (!(this.endDateTime instanceof Date) || Number.isNaN(this.endDateTime.getTime())) {
    return next(new Error('endDateTime must be a valid date'));
  }
  if (this.endDateTime <= this.startDateTime) {
    return next(new Error('endDateTime must be later than startDateTime'));
  }
  if ([this.isPending, this.isCompleted, this.isCancelled].filter(Boolean).length !== 1) {
    return next(new Error('Exactly one booking lifecycle state must be true'));
  }
  return next();
});

sequentialIdPlugin(bookingSchema, { field: 'bookingId', prefix: 'BKG' });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
