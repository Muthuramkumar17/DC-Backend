const mongoose = require("mongoose");
const sequentialIdPlugin = require("../config/sequentialId");

const auditLogSchema = new mongoose.Schema(
  {
    auditLogId: { type: String, required: true, unique: true },
    entityType: { type: String, trim: true, default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    operation: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "CREATE",
        "UPDATE",
        "DELETE",
        "STATUS_CHANGE",
        "PAYMENT_CHANGE",
        "LOGIN",
        "LOGOUT",
      ],
      required: true,
    },
    collectionName: { type: String, required: true, trim: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    operationDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date },
    eventTime: { type: Date, default: Date.now },
    actionAt: { type: Date, default: Date.now },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.pre("save", function (next) {
  if (this.actionBy && !this.userId) {
    this.userId = this.actionBy;
  } else if (this.userId && !this.actionBy) {
    this.actionBy = this.userId;
  }
  if (this.actionBy && this.updatedBy == null) {
    this.updatedBy = this.actionBy;
  }
  if (!this.entityType) this.entityType = this.collectionName;
  if (!this.entityId) this.entityId = this.recordId;
  if (!this.operationDetails) this.operationDetails = this.details;
  if (!this.createdBy) this.createdBy = this.actionBy || this.userId;
  if (!this.eventTime) this.eventTime = this.createdAt || new Date();
  if (!this.actionAt) this.actionAt = this.eventTime;
  next();
});

// Normalize legacy controller payloads while keeping AuditLog as the only model.
auditLogSchema.pre("validate", function (next) {
  const legacyEntities = [
    ["recordId", "API"],
    ["bookingId", "Booking"],
    ["customerId", "Customer"],
    ["pricingId", "Pricing"],
    ["roleId", "Role"],
    ["servicePaymentId", "ServicePayment"],
    ["subscriptionId", "Subscription"],
    ["subscriptionTypeId", "SubscriptionType"],
    ["userId", "User"],
  ];
  const entity = legacyEntities.find(([field]) => this[field] != null);
  if (!this.entityId && entity && mongoose.isValidObjectId(this[entity[0]]))
    this.entityId = this[entity[0]];
  if (!this.entityType) this.entityType = entity ? entity[1] : "API";
  if (!this.collectionName) this.collectionName = this.entityType;
  if (!this.operationDetails) this.operationDetails = this.details;
  if (!this.createdBy && mongoose.isValidObjectId(this.actionBy))
    this.createdBy = this.actionBy;
  if (!this.eventTime) this.eventTime = this.actionAt || new Date();
  if (!this.actionAt) this.actionAt = this.eventTime;
  next();
});

sequentialIdPlugin(auditLogSchema, { field: "auditLogId", prefix: "AUD" });

module.exports =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
