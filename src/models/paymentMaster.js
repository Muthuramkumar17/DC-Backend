const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const paymentMasterSchema = new mongoose.Schema(
  {
    paymentMasterId: { type: String, required: true, unique: true },
    cgstRate: { type: Number, required: true, min: 0 },
    sgstRate: { type: Number, required: true, min: 0 },
    discountRate: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentMasterSchema.index({ isActive: 1, effectiveFrom: -1 });
sequentialIdPlugin(paymentMasterSchema, { field: 'paymentMasterId', prefix: 'PMS' });

module.exports = mongoose.models.PaymentMaster || mongoose.model('PaymentMaster', paymentMasterSchema);
