const bcrypt = require("bcryptjs");
const Role = require("../models/role");
const User = require("../models/User");
const BathroomCount = require("../models/bathroomCount");
const ServiceDuration = require("../models/serviceDuration");
const ServiceFrequency = require("../models/serviceFrequency");
const SubscriptionType = require("../models/subscriptionType");
const TimeSlot = require("../models/timeSlot");
const PaymentMethod = require("../models/PaymentMethod");
const PaymentAccount = require("../models/paymentAccount");
const PaymentMaster = require("../models/paymentMaster");
const Pricing = require("../models/pricing");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");
const BookingDate = require("../models/bookingDate");
const Subscription = require("../models/subscription");
const Visit = require("../models/visit");
const Invoice = require("../models/invoice");
const ServicePayment = require("../models/servicePayment");
const Counter = require("../models/counter");
const AuditLog = require("../models/AuditLog");

const {
  role: roles,
  defaultUser,
  bathroomCounts,
  serviceDurations,
  serviceFrequencies,
  subscriptionTypes,
  timeSlots,
  paymentMethods,
  paymentAccounts,
  paymentMaster,
  pricing,
} = require("./masters");

const schemaFieldOrder = (schema) =>
  Object.keys(schema.paths).filter(
    (path) => path !== "__v" && !path.includes("."),
  );

const SYSTEM_USER_EMAIL = "system@gmail.com";

const valuesDiffer = (document, data) =>
  Object.keys(data).some(
    (key) => String(document[key] ?? "") !== String(data[key] ?? ""),
  );

const rewriteDocumentFieldOrder = async (Model) => {
  const order = schemaFieldOrder(Model.schema);
  const docs = await Model.collection.find({}).toArray();

  for (const doc of docs) {
    const ordered = {};

    for (const key of order) {
      if (doc[key] !== undefined) ordered[key] = doc[key];
    }

    for (const key of Object.keys(doc)) {
      if (key === "__v" || ordered[key] !== undefined) continue;
      ordered[key] = doc[key];
    }

    if (doc.__v !== undefined) ordered.__v = doc.__v;

    await Model.collection.replaceOne({ _id: doc._id }, ordered);
  }
};

const ALL_MODELS = [
  Role,
  User,
  BathroomCount,
  ServiceDuration,
  ServiceFrequency,
  SubscriptionType,
  TimeSlot,
  PaymentMethod,
  PaymentAccount,
  PaymentMaster,
  Pricing,
  Customer,
  Booking,
  BookingDate,
  Subscription,
  Visit,
  Invoice,
  ServicePayment,
  Counter,
  AuditLog,
];

const syncMaster = async (Model, filter, data, systemUserId) => {
  const existing = await Model.findOne(filter);

  if (existing) {
    const changed = valuesDiffer(existing, data);
    const missingAuditReference = systemUserId && !existing.createdBy;
    if (!changed && !missingAuditReference) return existing;
    if (changed) Object.assign(existing, data);
    if (missingAuditReference) existing.createdBy = systemUserId;
    if (changed) existing.updatedBy = systemUserId;
    return existing.save();
  }

  const createData = {
    ...data,
    createdBy: systemUserId,
    updatedBy: systemUserId,
  };
  if (typeof Model.getNextSequentialId === "function" && Model.sequentialIdField && !createData[Model.sequentialIdField]) {
    createData[Model.sequentialIdField] = await Model.getNextSequentialId();
  }
  return Model.create(createData);
};

const ensureSystemUser = async (userRole) => {
  const existing = await User.findOne({ email: SYSTEM_USER_EMAIL });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(
    process.env.SYSTEM_USER_PASSWORD || require("crypto").randomBytes(32).toString("hex"),
    12,
  );

  return User.create({
    userId: await User.getNextSequentialId(),
    userName: "System Seed User",
    email: SYSTEM_USER_EMAIL,
    passwordHash,
    roleReference: userRole._id,
    isActive: true,
  });
};

const seedDatabase = async () => {
  try {
    console.log("Synchronizing master data...");

    // Roles
    for (const role of roles) {
      await syncMaster(Role, { roleName: role.roleName }, role, null);
    }

    const systemRole = await Role.findOne({ roleName: "superadmin" });
    const systemUser = await ensureSystemUser(systemRole);
    for (const role of roles) {
      await syncMaster(Role, { roleName: role.roleName }, role, systemUser._id);
    }

    // Default users
    for (const item of defaultUser) {
      const userRole = await Role.findOne({ roleName: item.roleName });
      const existingUser = await User.findOne({ email: item.email });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(item.password, 10);

        await User.create({
          userId: await User.getNextSequentialId(),
          userName: item.name,
          email: item.email,
          passwordHash: hashedPassword,
          roleReference: userRole._id,
          isActive: item.isActive,
          createdBy: systemUser._id,
          updatedBy: systemUser._id,
        });
      } else if (!existingUser.createdBy) {
        existingUser.createdBy = systemUser._id;
        await existingUser.save();
      }
    }

    // Bathroom counts
    for (const item of bathroomCounts) {
      await syncMaster(
        BathroomCount,
        { bathroomCount: item.bathroomCount },
        item,
        systemUser._id,
      );
    }

    // Service durations
    for (const item of serviceDurations) {
      await syncMaster(
        ServiceDuration,
        { durationMinutes: item.durationMinutes },
        item,
        systemUser._id,
      );
    }

    // Service frequencies
    for (const item of serviceFrequencies) {
      await syncMaster(
        ServiceFrequency,
        { frequencyName: item.frequencyName },
        item,
        systemUser._id,
      );
    }

    // Subscription types
    for (const item of subscriptionTypes) {
      await syncMaster(
        SubscriptionType,
        { subscriptionName: item.subscriptionName },
        item,
        systemUser._id,
      );
    }

    // Time slots
    for (const item of timeSlots) {
      await syncMaster(
        TimeSlot,
        { startTime: item.startTime, endTime: item.endTime },
        item,
        systemUser._id,
      );
    }

    // Payment methods
    for (const item of paymentMethods) {
      await syncMaster(
        PaymentMethod,
        { paymentMethodName: item.paymentMethodName },
        item,
        systemUser._id,
      );
    }

    // Payment accounts
    for (const item of paymentAccounts) {
      await syncMaster(PaymentAccount, { accountName: item.accountName }, item, systemUser._id);
    }

    // Payment master
    await syncMaster(PaymentMaster, { isActive: true }, paymentMaster, systemUser._id);

    // Pricing
    for (const item of pricing) {
      const bathroom = await BathroomCount.findOne({
        bathroomCount: item.bathroomCount,
      });

      const frequency = await ServiceFrequency.findOne({ frequencyName: item.frequencyName });
      const subscription = await SubscriptionType.findOne({ subscriptionName: item.subscriptionName });

      await syncMaster(
        Pricing,
        {
          bathroomCountReference: bathroom._id,
          serviceFrequencyReference: frequency._id,
          subscriptionTypeReference: subscription._id,
        },
        {
          bathroomCountReference: bathroom._id,
          serviceFrequencyReference: frequency._id,
          subscriptionTypeReference: subscription._id,
          price: item.price,
          isActive: item.isActive,
        },
        systemUser._id,
      );
    }

    console.log("Master data synchronized successfully.");
  } catch (error) {
    console.error("Master data synchronization failed:", error.message);
    throw error;
  }
};

module.exports = { seedDatabase };
