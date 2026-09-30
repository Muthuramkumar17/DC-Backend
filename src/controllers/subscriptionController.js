const mongoose = require("mongoose");
const Subscription = require("../models/subscription");
const Visit = require("../models/visit");

const populateSubscriptionReferences = (query) => {
  return query
    .populate("bookingReference")
    .populate("customerReference")
    .populate("pricingReference")
    .populate("serviceFrequencyReference")
    .populate("subscriptionTypeReference");
};

//getAllSubscriptions
exports.getAllSubscriptions = async (req, res) => {
  try {
    const filter = { isActive: true };

    if (req.query.customerReference) {
      filter.customerReference = req.query.customerReference;
    }

    if (req.query.subscriptionStatus) {
      filter.subscriptionStatus = req.query.subscriptionStatus;
    }

    const subscriptions = await populateSubscriptionReferences(
      Subscription.find(filter),
    ).sort({ createdAt: -1 });

    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getSubscriptionById
exports.getSubscriptionById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid subscription ID" });
    }

    const subscription = await populateSubscriptionReferences(
      Subscription.findById(req.params.id),
    );

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const visits = await Visit.find({
      subscriptionReference: subscription._id,
    }).sort({ visitNumber: 1 });

    res.status(200).json({ subscription, visits });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
