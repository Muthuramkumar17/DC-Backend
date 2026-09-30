const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const paymentAccountSchema = new mongoose.Schema(
  {
    paymentAccountId: { type: String, required: true, unique: true },
    accountName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(paymentAccountSchema, { field: 'paymentAccountId', prefix: 'PAC' });

module.exports = mongoose.models.PaymentAccount || mongoose.model('PaymentAccount', paymentAccountSchema);
