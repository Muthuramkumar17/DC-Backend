const mongoose = require("mongoose");
const Invoice = require("../models/invoice");
const ServicePayment = require("../models/servicePayment");
const Counter = require("../models/counter");
const AuditLog = require("../models/auditLog");

//populateInvoiceReferences 
const populateInvoiceReferences = (query) =>
  query
    .populate("customerReference")
    .populate({
      path: "bookingReference",
      populate: [
        { path: "serviceFrequencyReference" },
        { path: "subscriptionTypeReference" },
        { path: "bathroomCountReference" },
        { path: "pricingReference" },
        { path: "timeSlotReference" },
      ],
    })
    .populate("servicePaymentReference");

//createInvoice
exports.createInvoice = async (req, res) => {
  try {
    const { customerReference, bookingReference, servicePaymentReference } =
      req.body;
    if (!customerReference || !bookingReference || !servicePaymentReference)
      return res.status(400).json({
        message:
          "customerReference, bookingReference, and servicePaymentReference are required",
      });
    if (
      ![customerReference, bookingReference, servicePaymentReference].every(
        mongoose.Types.ObjectId.isValid,
      )
    )
      return res.status(400).json({ message: "Invalid invoice reference" });
    const payment = await ServicePayment.findOne({
      _id: servicePaymentReference,
      bookingReference,
    });
    if (!payment)
      return res
        .status(404)
        .json({ message: "Service payment not found for this booking" });
    const counter = await Counter.findByIdAndUpdate(
      `invoice-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const invoice = await Invoice.create({
      invoiceNumber: `JHN${dateKey}-${String(counter.seq).padStart(4, "0")}`,
      customerReference,
      bookingReference,
      servicePaymentReference,
      amount: payment.totalAmount,
      createdBy: req.user && req.user.userId,
    });
    await AuditLog.create({
      actionBy: req.user && req.user.userId,
      operation: "create",
      collectionName: "invoices",
      recordId: invoice._id,
    });
    res.status(201).json(invoice);
  } catch (error) {
    res
      .status(error.code === 11000 ? 409 : 500)
      .json({ message: error.message });
  }
};

//getAllInvoices
exports.getAllInvoices = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.customerReference)
      filter.customerReference = req.query.customerReference;
    if (req.query.bookingReference)
      filter.bookingReference = req.query.bookingReference;
    res
      .status(200)
      .json(
        await populateInvoiceReferences(
          Invoice.find(filter).sort({ createdAt: -1 }),
        ),
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getInvoiceById
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await populateInvoiceReferences(
      Invoice.findById(req.params.id),
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getInvoiceByBookingId
exports.getInvoiceByBookingId = async (req, res) => {
  try {
    const invoice = await populateInvoiceReferences(
      Invoice.findOne({ bookingReference: req.params.bookingId }),
    );
    if (!invoice)
      return res
        .status(404)
        .json({ message: "Invoice not found for this booking" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteInvoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await AuditLog.create({
      actionBy: req.user && req.user.userId,
      operation: "delete",
      collectionName: "invoices",
      recordId: invoice._id,
    });
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
