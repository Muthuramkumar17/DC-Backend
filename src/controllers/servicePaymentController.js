const ServicePayment = require("../models/servicePayment");

//getAllServicePayments
exports.getAllServicePayments = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.bookingReference)
      filter.bookingReference = req.query.bookingReference;
    if (req.query.customerReference)
      filter.customerReference = req.query.customerReference;
    res
      .status(200)
      .json(
        await ServicePayment.find(filter)
          .populate("bookingReference")
          .populate("subscriptionReference")
          .populate("customerReference")
          .populate("pricingReference")
          .populate("paymentMasterReference")
          .sort({ createdAt: -1 }),
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getServicePaymentById
exports.getServicePaymentById = async (req, res) => {
  try {
    const item = await ServicePayment.findById(req.params.id)
      .populate("bookingReference")
      .populate("subscriptionReference")
      .populate("customerReference")
      .populate("pricingReference")
      .populate("paymentMasterReference");
    if (!item)
      return res.status(404).json({ message: "Service payment not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateServicePayment
exports.updateServicePayment = async (req, res) => {
  try {
    const allowed = [
      "transactionId",
      "isPending",
      "isCompleted",
      "isCancelled",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const lifecycleKeys = ["isPending", "isCompleted", "isCancelled"];
    if (
      lifecycleKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(update, key),
      )
    ) {
      const lifecycle = lifecycleKeys.map((key) => update[key] === true);
      if (lifecycle.filter(Boolean).length !== 1)
        return res
          .status(400)
          .json({
            message: "Exactly one service payment lifecycle state must be true",
          });
    }
    const item = await ServicePayment.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!item)
      return res.status(404).json({ message: "Service payment not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
