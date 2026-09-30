const PaymentMaster = require("../models/paymentMaster");
const AuditLog = require("../models/auditLog");

//createPaymentMaster
exports.createPaymentMaster = async (req, res) => {
  try {
    const {
      cgstRate,
      sgstRate,
      discountRate,
      effectiveFrom,
      effectiveTo,
      isActive,
    } = req.body;
    if ([cgstRate, sgstRate, discountRate].some((value) => value === undefined))
      return res
        .status(400)
        .json({ message: "cgstRate, sgstRate, and discountRate are required" });
    const item = await PaymentMaster.create({
      cgstRate,
      sgstRate,
      discountRate,
      effectiveFrom,
      effectiveTo,
      isActive: isActive === undefined ? true : isActive,
      createdBy: req.user && req.user.userId,
    });
    await AuditLog.create({
      actionBy: req.user && req.user.userId,
      operation: "create",
      collectionName: "paymentMasters",
      recordId: item._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllPaymentMasters
exports.getAllPaymentMasters = async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await PaymentMaster.find(
          req.query.isActive === undefined
            ? {}
            : { isActive: req.query.isActive === "true" },
        ).sort({ effectiveFrom: -1 }),
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getPaymentMasterById
exports.getPaymentMasterById = async (req, res) => {
  try {
    const item = await PaymentMaster.findById(req.params.id);
    if (!item)
      return res.status(404).json({ message: "Payment master not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updatePaymentMaster
exports.updatePaymentMaster = async (req, res) => {
  try {
    const item = await PaymentMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!item)
      return res.status(404).json({ message: "Payment master not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deletePaymentMaster
exports.deletePaymentMaster = async (req, res) => {
  try {
    const item = await PaymentMaster.findByIdAndDelete(req.params.id);
    if (!item)
      return res.status(404).json({ message: "Payment master not found" });
    res.status(200).json({ message: "Payment master deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
