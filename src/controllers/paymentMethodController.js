const PaymentMethod = require('../models/paymentMethod');
const AuditLog = require('../models/auditLog');


//createPaymentMethod
exports.createPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodName, isActive } = req.body;
    if (!paymentMethodName) {
      return res.status(400).json({ message: 'paymentMethodName is required' });
    }

    const paymentMethod = new PaymentMethod({ paymentMethodId: await PaymentMethod.getNextSequentialId(),
      paymentMethodName,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedPaymentMethod = await paymentMethod.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'create',
      collectionName: 'paymentMethods',
      recordId: savedPaymentMethod._id,
    });

    res.status(201).json(savedPaymentMethod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllPaymentMethods
exports.getAllPaymentMethods = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    const paymentMethods = await PaymentMethod.find(filter).sort({ createdAt: -1 });
    res.status(200).json(paymentMethods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getPaymentMethodById
exports.getPaymentMethodById = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' });
    }
    res.status(200).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updatePaymentMethod
exports.updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodName, isActive } = req.body;
    const updateData = {};
    if (paymentMethodName !== undefined) updateData.paymentMethodName = paymentMethodName;
    if (isActive !== undefined) updateData.isActive = isActive;

    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'update',
      collectionName: 'paymentMethods',
      recordId: paymentMethod._id,
    });

    res.status(200).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deletePaymentMethod
exports.deletePaymentMethod = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findByIdAndDelete(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'delete',
      collectionName: 'paymentMethods',
      recordId: paymentMethod._id,
    });

    res.status(200).json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
