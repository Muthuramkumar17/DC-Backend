const PaymentAccount = require("../models/paymentAccount");
const AuditLog = require("../models/AuditLog");

//createPaymentAccount
exports.createPaymentAccount = async (req, res) => {
  try {
    const { accountName, isActive } = req.body;
    if (!accountName) {
      return res.status(400).json({ message: "accountName is required" });
    }

    const account = new PaymentAccount({ paymentAccountId: await PaymentAccount.getNextSequentialId(),
      accountName,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedAccount = await account.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "create",
      collectionName: "paymentAccounts",
      recordId: savedAccount._id,
    });

    res.status(201).json(savedAccount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllPaymentAccounts
exports.getAllPaymentAccounts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    const accounts = await PaymentAccount.find(filter).sort({ createdAt: -1 });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getPaymentAccountById
exports.getPaymentAccountById = async (req, res) => {
  try {
    const account = await PaymentAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "Payment account not found" });
    }
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updatePaymentAccount
exports.updatePaymentAccount = async (req, res) => {
  try {
    const { accountName, isActive } = req.body;
    const updateData = {};
    if (accountName !== undefined) updateData.accountName = accountName;
    if (isActive !== undefined) updateData.isActive = isActive;

    const account = await PaymentAccount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    if (!account) {
      return res.status(404).json({ message: "Payment account not found" });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "update",
      collectionName: "paymentAccounts",
      recordId: account._id,
    });

    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deletePaymentAccount
exports.deletePaymentAccount = async (req, res) => {
  try {
    const account = await PaymentAccount.findByIdAndDelete(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "Payment account not found" });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "delete",
      collectionName: "paymentAccounts",
      recordId: account._id,
    });

    res.status(200).json({ message: "Payment account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
