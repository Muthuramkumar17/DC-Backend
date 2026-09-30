const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    customerReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    bookingReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    servicePaymentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePayment', unique: true, sparse: true, default: null },
    amount: { type: Number, required: true },
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

invoiceSchema.index({ bookingReference: 1 }, { unique: true });
invoiceSchema.pre('validate', function validateLifecycle(next) {
  if ([this.isPending, this.isCompleted, this.isCancelled].filter(Boolean).length !== 1) {
    return next(new Error('Exactly one invoice lifecycle state must be true'));
  }
  return next();
});

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
