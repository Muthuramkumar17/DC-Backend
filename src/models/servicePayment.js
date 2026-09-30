const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const servicePaymentSchema = new mongoose.Schema(
  {
    servicePaymentId: { type: String, required: true, unique: true },
    pricePerVisit: { type: Number, required: true, min: 0 },
    totalServiceVisits: { type: Number, required: true, min: 1 },
    baseAmount: { type: Number, required: true, min: 0 },
    cgstRate: { type: Number, required: true, min: 0 },
    cgstAmount: { type: Number, required: true, min: 0 },
    sgstRate: { type: Number, required: true, min: 0 },
    sgstAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    discountReason: { type: String, trim: true, default: '' },
    totalAmount: { type: Number, required: true, min: 0 },
    transactionId: { type: String, trim: true, default: '' },
    bookingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    subscriptionReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
    customerReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    pricingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Pricing', required: true },
    paymentMasterReference: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMaster', required: true },
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

servicePaymentSchema.pre('validate', function validateLifecycle(next) {
  if ([this.isPending, this.isCompleted, this.isCancelled].filter(Boolean).length !== 1) {
    return next(new Error('Exactly one service payment lifecycle state must be true'));
  }
  return next();
});

sequentialIdPlugin(servicePaymentSchema, { field: 'servicePaymentId', prefix: 'SPY' });

module.exports = mongoose.models.ServicePayment || mongoose.model('ServicePayment', servicePaymentSchema);
