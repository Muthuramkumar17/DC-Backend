const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const paymentMethodSchema = new mongoose.Schema(
  {
    paymentMethodId: { type: String, required: true, unique: true },
    paymentMethodName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(paymentMethodSchema, { field: 'paymentMethodId', prefix: 'PMT' });

module.exports = mongoose.models.PaymentMethod || mongoose.model('PaymentMethod', paymentMethodSchema);
