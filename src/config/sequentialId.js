const Counter = require('../models/counter');
const mongoose = require('mongoose');

function sequentialIdPlugin(schema, { field, prefix }) {
  schema.statics.sequentialIdField = field;
  schema.statics.sequentialIdPrefix = prefix;
  schema.statics.getNextSequentialId = async function getNextSequentialId(session) {
    const counter = await Counter.findOneAndUpdate(
      { _id: `id:${prefix}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const width = prefix === 'AUD' ? 5 : 2;
    return `${prefix}_${String(counter.seq).padStart(width, '0')}`;
  };

  // Backward-compatible safety net for direct create()/insertMany() paths.
  // Explicitly generated IDs are always preserved.
  schema.pre('validate', async function assignSequentialIdWhenMissing(next) {
    if (this.entityId == null) {
      const entityField = ['recordId', 'bookingId', 'customerId', 'pricingId', 'roleId', 'servicePaymentId', 'subscriptionId', 'subscriptionTypeId', 'userId']
        .find((candidate) => this[candidate] != null);
      if (entityField && mongoose.isValidObjectId(this[entityField])) {
        this.entityId = this[entityField];
      }
    }
    if (this.operationDetails == null && this.details != null) this.operationDetails = this.details;
    const auditActor = this.actionBy || this.userId;
    if (this.createdBy == null && mongoose.isValidObjectId(auditActor)) this.createdBy = auditActor;
    if (this.eventTime == null) this.eventTime = this.actionAt || new Date();
    if (this.actionAt == null) this.actionAt = this.eventTime;
    if (this[field]) return next();
    try {
      this[field] = await this.constructor.getNextSequentialId(this.$session());
      return next();
    } catch (error) {
      return next(error);
    }
  });

}

module.exports = sequentialIdPlugin;
