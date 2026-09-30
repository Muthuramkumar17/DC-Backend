const SubscriptionType = require("../models/subscriptionType");
const AuditLog = require("../models/AuditLog");
const SubscriptionTypeLog = require("../models/AuditLog");

//createSubscriptionType
exports.createSubscriptionType = async (req, res) => {
  try {
    const { subscriptionName, timeGap, isActive } = req.body;
    if (!subscriptionName) {
      return res.status(400).json({ message: "subscriptionName is required" });
    }
    if (!timeGap) {
      return res.status(400).json({ message: "timeGap is required" });
    }

    const subscription = new SubscriptionType({ subscriptionTypeId: await SubscriptionType.getNextSequentialId(),
      subscriptionName,
      timeGap,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedSubscription = await subscription.save();

    await SubscriptionTypeLog.create({
      operation: "CREATE",
      actionBy: req.user ? req.user.userId : null,
      subscriptionTypeId: savedSubscription._id,
      details: {
        action: "Subscription plan created",
        subscriptionName: savedSubscription.subscriptionName,
      },
      newValue: savedSubscription.toObject(),
    });
    res.status(201).json(savedSubscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllSubscriptionTypes
exports.getAllSubscriptionTypes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    const subscriptions = await SubscriptionType.find(filter).sort({
      createdAt: -1,
    });
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// getSubscriptionTypeById
exports.getSubscriptionTypeById = async (req, res) => {
  try {
    const subscription = await SubscriptionType.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription type not found" });
    }
    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateSubscriptionType
exports.updateSubscriptionType = async (req, res) => {
  try {
    const { subscriptionName, timeGap, isActive } = req.body;
    const previousSub = await SubscriptionType.findById(req.params.id);
    if (!previousSub) {
      return res.status(404).json({ message: "Subscription type not found" });
    }

    const updateData = {};
    if (subscriptionName !== undefined)
      updateData.subscriptionName = subscriptionName;
    if (timeGap !== undefined) updateData.timeGap = timeGap;
    if (isActive !== undefined) updateData.isActive = isActive;

    const subscription = await SubscriptionType.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    await SubscriptionTypeLog.create({
      operation: "UPDATE",
      actionBy: req.user ? req.user.userId : null,
      subscriptionTypeId: subscription._id,
      details: {
        updatedFields: Object.keys(updateData),
      },
      previousValue: previousSub.toObject(),
      newValue: subscription.toObject(),
    });

    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteSubscriptionType
exports.deleteSubscriptionType = async (req, res) => {
  try {
    const subscription = await SubscriptionType.findByIdAndDelete(
      req.params.id,
    );
    if (!subscription) {
      return res.status(404).json({ message: "Subscription type not found" });
    }

    await SubscriptionTypeLog.create({
      operation: "DELETE",
      actionBy: req.user ? req.user.userId : null,
      subscriptionTypeId: subscription._id,
      details: {
        action: "Subscription plan deleted",
      },
      previousValue: subscription.toObject(),
      newValue: null,
    });

    res.status(200).json({ message: "Subscription type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
