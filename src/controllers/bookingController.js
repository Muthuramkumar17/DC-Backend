const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Invoice = require('../models/invoice');
const Counter = require('../models/counter');
const TimeSlot = require('../models/timeSlot');
const ServiceDuration = require('../models/serviceDuration');
const ServiceFrequency = require('../models/serviceFrequency');
const Pricing = require('../models/pricing');
const PaymentAccount = require('../models/paymentAccount');
const PaymentMaster = require('../models/paymentMaster');
const ServicePayment = require('../models/servicePayment');
const SubscriptionType = require('../models/subscriptionType');
const Subscription = require('../models/subscription');
const Visit = require('../models/visit');
const BookingLog = require('../models/AuditLog');
const ServicePaymentLog = require('../models/AuditLog');
const availabilityService = require('../services/availabilityService');

//createBooking
exports.createBooking = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    let {
      customerId,
      bathroomCountId,
      pricingId,
      serviceDurationId,
      serviceFrequencyId,
      subscriptionTypeId,
      timeSlotId,
      scheduledDate,
      startTime,
      discount,
      discountReason,
      paymentMethodId,
      paymentAccountId,
      transactionId,
    } = req.body;

    if (!customerId) return res.status(400).json({ message: 'customerId is required' });
    if (!scheduledDate) return res.status(400).json({ message: 'scheduledDate is required' });
    if (!timeSlotId) return res.status(400).json({ message: 'timeSlotId is required' });
    if (!pricingId) return res.status(400).json({ message: 'pricingId is required' });

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: 'Invalid customerId' });
    }
    if (!mongoose.Types.ObjectId.isValid(pricingId)) {
      return res.status(400).json({ message: 'Invalid pricingId' });
    }
    if (discount !== undefined && (!Number.isFinite(Number(discount)) || Number(discount) < 0)) {
      return res.status(400).json({ message: 'discount must be a finite, non-negative number' });
    }
    if (transactionId !== undefined && typeof transactionId !== 'string') {
      return res.status(400).json({ message: 'transactionId must be a string' });
    }
    transactionId = transactionId === undefined ? '' : transactionId.trim();

    const normalizedDateStr = String(scheduledDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateStr)) {
      return res.status(400).json({ message: 'scheduledDate must use YYYY-MM-DD format' });
    }
    const [year, month, day] = normalizedDateStr.split('-').map(Number);
    const strictDate = new Date(Date.UTC(year, month - 1, day));
    if (
      strictDate.getUTCFullYear() !== year ||
      strictDate.getUTCMonth() !== month - 1 ||
      strictDate.getUTCDate() !== day
    ) {
      return res.status(400).json({ message: 'scheduledDate must be a valid calendar date' });
    }

    const customer = await Customer.findOne({ _id: customerId, isActive: true }).select('_id');
    if (!customer) {
      return res.status(404).json({ message: 'Active customer not found' });
    }

    // Extract slot start time and mongo ID from timeSlotId format (e.g. `<mongoId>-<minutes>`)
    let slotStartMinutes = null;
    let actualTimeSlotMongoId = timeSlotId;

    if (typeof timeSlotId === 'string' && timeSlotId.includes('-')) {
      const parts = timeSlotId.split('-');
      actualTimeSlotMongoId = parts[0];
      const parsedOffset = parseInt(parts[1], 10);
      if (!isNaN(parsedOffset)) {
        slotStartMinutes = parsedOffset;
      }
    }

    if (!mongoose.Types.ObjectId.isValid(actualTimeSlotMongoId)) {
      return res.status(400).json({ message: 'Invalid timeSlotId' });
    }

    const selectedTimeSlot = await TimeSlot.findById(actualTimeSlotMongoId);
    if (!selectedTimeSlot) {
      return res.status(404).json({ message: 'Selected time slot not found' });
    }

    // Parse startTime if provided in body or fallback to slot offset or time slot start
    if (startTime) {
      const parsed = availabilityService.parseTimeToMinutes(startTime);
      if (parsed !== null) slotStartMinutes = parsed;
    }

    if (slotStartMinutes === null) {
      slotStartMinutes = availabilityService.parseTimeToMinutes(selectedTimeSlot.startTime);
    }

    if (slotStartMinutes === null) {
      return res.status(400).json({ message: 'Unable to determine slot start time' });
    }

    // Resolve service duration and pricing
    const selectedPricing = await Pricing.findOne({
      _id: pricingId,
      bathroomCountReference: bathroomCountId,
      serviceFrequencyReference: serviceFrequencyId,
      subscriptionTypeReference: subscriptionTypeId,
      isActive: true,
    });

    if (!selectedPricing) {
      return res.status(404).json({ message: 'Active pricing record not found' });
    }

    const resolvedServiceDuration = await availabilityService.resolveServiceDuration({
      pricingId,
      serviceDurationId,
      bathroomCountId,
    });

    const resolvedBufferTime = Number(selectedTimeSlot.bufferTime);
    if (!Number.isFinite(resolvedBufferTime) || resolvedBufferTime < 0) {
      return res.status(400).json({ message: 'Selected TimeSlot has missing or invalid BufferTime master data' });
    }
    const totalDuration = resolvedServiceDuration + resolvedBufferTime;

    const calculatedStartDateTime = availabilityService.combineDateAndTime(normalizedDateStr, slotStartMinutes);
    const calculatedEndDateTime = availabilityService.combineDateAndTime(normalizedDateStr, slotStartMinutes + totalDuration);

    if (!calculatedStartDateTime || !calculatedEndDateTime) {
      return res.status(400).json({ message: 'Unable to calculate booking startDateTime and endDateTime' });
    }

    const operatingStartMinutes = availabilityService.parseTimeToMinutes(selectedTimeSlot.startTime);
    const operatingEndMinutes = availabilityService.parseTimeToMinutes(selectedTimeSlot.endTime);
    if (
      operatingStartMinutes === null ||
      operatingEndMinutes === null ||
      slotStartMinutes < operatingStartMinutes ||
      slotStartMinutes + totalDuration > operatingEndMinutes
    ) {
      return res.status(400).json({
        message: `Booking must fit within the selected time slot (${selectedTimeSlot.startTime} - ${selectedTimeSlot.endTime})`,
      });
    }

    // Subscription & multi-visit scheduling
    const shouldCreateSubscription = subscriptionTypeId !== undefined && subscriptionTypeId !== null;
    let normalizedTotalVisits = 1;
    let subscriptionType = null;
    let scheduleIntervalDays = null;
    let serviceFrequency = null;
    let subscriptionEndDate = null;
    let visitScheduleDates = [];

    if (shouldCreateSubscription) {
      if (!serviceFrequencyId) {
        return res.status(400).json({
          message: 'serviceFrequencyId is required for a subscription booking',
        });
      }

      subscriptionType = await SubscriptionType.findOne({ _id: subscriptionTypeId, isActive: true });
      if (!subscriptionType) {
        return res.status(404).json({ message: 'Subscription type not found' });
      }

      serviceFrequency = await ServiceFrequency.findOne({ _id: serviceFrequencyId, isActive: true });
      if (!serviceFrequency) {
        return res.status(404).json({ message: 'Service frequency not found' });
      }

      scheduleIntervalDays = Number(serviceFrequency.intervalDays) || 7;

      const schedule = buildVisitSchedule({
        startDateTime: calculatedStartDateTime,
        endDateTime: calculatedEndDateTime,
        subscriptionType,
        serviceFrequency,
      });

      subscriptionEndDate = schedule.subscriptionEndDate;
      visitScheduleDates = schedule.visitScheduleDates;
      normalizedTotalVisits = visitScheduleDates.length || 1;
    }

    // RULE 2: Backend Final Overlap Protection Check before writing to database
    const overlapResult = await availabilityService.checkBookingOverlap({
      scheduledDate: normalizedDateStr,
      startDateTime: calculatedStartDateTime,
      endDateTime: calculatedEndDateTime,
      visitScheduleDates: shouldCreateSubscription ? visitScheduleDates : [],
    });

    if (overlapResult.hasConflict) {
      return res.status(409).json({
        message: 'The selected date and time slot is already booked. Please choose another slot.',
        reason: overlapResult.reason,
      });
    }

    const userId = getUserObjectId(req);
    let savedBooking = null;
    let savedPayment = null;
    let savedInvoice = null;
    let savedSubscription = null;
    let savedVisits = [];

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const paymentMaster = await PaymentMaster.findOne({
          isActive: true,
          effectiveFrom: { $lte: new Date() },
          $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
        }).sort({ effectiveFrom: -1 }).session(session);

        if (!paymentMaster) {
          const error = new Error('No active payment master configuration found');
          error.status = 400;
          throw error;
        }

        const booking = new Booking({ bookingId: await Booking.getNextSequentialId(session),
          customerReference: customerId,
          bathroomCountReference: bathroomCountId || null,
          pricingReference: pricingId || null,
          serviceDurationReference: serviceDurationId || null,
          serviceFrequencyReference: serviceFrequencyId || null,
          subscriptionTypeReference: subscriptionTypeId || null,
          timeSlotReference: actualTimeSlotMongoId,
          scheduledDate: new Date(`${normalizedDateStr}T00:00:00.000Z`),
          startDateTime: calculatedStartDateTime,
          endDateTime: calculatedEndDateTime,
          paymentMethodReference: paymentMethodId || null,
          paymentAccountReference: paymentAccountId || null,
          transactionId: transactionId || '',
          amount: 0,
          createdBy: userId,
        });

        booking.$session(session);
        savedBooking = await booking.save();

        if (shouldCreateSubscription) {
          const subscription = new Subscription({ subscriptionId: await Subscription.getNextSequentialId(session),
            bookingReference: savedBooking._id,
            customerReference: customerId,
            pricingReference: pricingId,
            serviceFrequencyReference: serviceFrequencyId,
            subscriptionTypeReference: subscriptionType._id,
            createdBy: userId,
            startDate: calculatedStartDateTime,
            endDate: subscriptionEndDate,
            totalVisits: normalizedTotalVisits,
            completedVisits: 0,
            remainingVisits: normalizedTotalVisits,
            scheduleIntervalDays,
            subscriptionStatus: 'Upcoming',
          });

          subscription.$session(session);
          savedSubscription = await subscription.save();

          const visitIds = await Promise.all(
            visitScheduleDates.map(() => Visit.getNextSequentialId(session))
          );
          const visits = visitScheduleDates.map((schedule, index) => ({
            visitId: visitIds[index],
            subscriptionReference: savedSubscription._id,
            bookingReference: savedBooking._id,
            customerReference: customerId,
            timeSlotReference: actualTimeSlotMongoId,
            createdBy: userId,
            updatedBy: userId,
            visitNumber: index + 1,
            scheduledStartDateTime: schedule.scheduledStartDateTime,
            scheduledEndDateTime: schedule.scheduledEndDateTime,
          }));

          savedVisits = await Visit.insertMany(visits, { session, ordered: true });
        }

        const pricePerVisit = Number(selectedPricing.price);
        const { baseAmount, cgstAmount, sgstAmount, discountAmount, totalAmount } = buildBillBreakdown({
          pricePerVisit,
          totalVisits: normalizedTotalVisits,
          discount,
          paymentMaster,
        });

        const servicePayment = new ServicePayment({ servicePaymentId: await ServicePayment.getNextSequentialId(session),
          bookingReference: savedBooking._id,
          subscriptionReference: savedSubscription?._id || null,
          customerReference: customerId,
          pricingReference: selectedPricing._id,
          paymentMasterReference: paymentMaster._id,
          paymentMethodReference: paymentMethodId || null,
          paymentAccountReference: paymentAccountId || null,
          createdBy: userId,
          pricePerVisit,
          totalServiceVisits: normalizedTotalVisits,
          baseAmount,
          cgstRate: paymentMaster.cgstRate,
          cgstAmount,
          sgstRate: paymentMaster.sgstRate,
          sgstAmount,
          discountRate: 0,
          discountAmount,
          totalAmount,
          transactionId: transactionId || '',
        });

        servicePayment.$session(session);
        savedPayment = await servicePayment.save();

        savedBooking.amount = totalAmount;
        await savedBooking.save({ session });

        const dateKey = getDate(calculatedStartDateTime);
        const counter = await Counter.findByIdAndUpdate(
          `invoice-${dateKey}`,
          { $inc: { seq: 1 } },
          { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );

        const invoice = new Invoice({
          invoiceNumber: `JHN${dateKey}-${String(counter.seq).padStart(4, '0')}`,
          customerReference: customerId,
          bookingReference: savedBooking._id,
          servicePaymentReference: savedPayment._id,
          amount: savedPayment.totalAmount,
          createdBy: userId,
        });

        invoice.$session(session);
        savedInvoice = await invoice.save();

        await ServicePaymentLog.create([{
          operation: 'CREATE',
          actionBy: userId,
          servicePaymentId: savedPayment._id,
          details: { action: 'Service payment calculated during booking creation' },
          previousValue: null,
          newValue: savedPayment.toObject(),
        }], { session });

        await BookingLog.insertMany([{
          operation: 'CREATE',
          actionBy: userId,
          bookingId: savedBooking._id,
          details: {
            action: shouldCreateSubscription
              ? 'Booking created, subscription, visits, service payment and invoice generated'
              : 'Booking created, service payment and invoice generated',
            invoiceNumber: savedInvoice?.invoiceNumber,
            amount: savedBooking.amount,
            servicePaymentId: savedPayment._id,
            subscriptionId: savedSubscription?.subscriptionId,
            totalVisits: savedVisits.length || undefined,
          },
          previousValue: null,
          newValue: savedBooking.toObject(),
        }], { session, ordered: true });
      });
    } finally {
      await session.endSession();
    }

    const populatedBooking = await populateBookingReferences(
      Booking.findById(savedBooking._id)
    );

    const response = {
      message: 'Booking created and invoice generated successfully',
      booking: populatedBooking,
    };

    if (savedInvoice) response.invoice = savedInvoice;
    if (savedSubscription) {
      response.subscription = savedSubscription;
      response.visits = savedVisits;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('createBooking error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A related booking record already exists' });
    }
    res.status(error.status || 500).json({ message: error.message });
  }
};

//getAllBookings
exports.getAllBookings = async (req, res) => {
  try {
    const {
      customerId,
      customerReference,
      bookingDate,
      date,
      status,
      isPending,
      isCompleted,
      isCancelled,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    const targetCustomer = customerId || customerReference;
    if (targetCustomer) {
      filter.customerReference = targetCustomer;
    }

    if (isPending !== undefined) {
      filter.isPending = isPending === true || isPending === 'true';
    }

    if (isCompleted !== undefined) {
      filter.isCompleted = isCompleted === true || isCompleted === 'true';
    }

    if (isCancelled !== undefined) {
      filter.isCancelled = isCancelled === true || isCancelled === 'true';
    }

    if (status) {
      const lowerStatus = String(status).trim().toLowerCase();
      if (lowerStatus === 'active' || lowerStatus === 'confirmed') {
        filter.isCancelled = false;
      } else if (lowerStatus === 'completed') {
        filter.isCompleted = true;
        filter.isCancelled = false;
      } else if (lowerStatus === 'cancelled') {
        filter.isCancelled = true;
      } else if (lowerStatus === 'pending') {
        filter.isPending = true;
        filter.isCancelled = false;
      }
    }

    const exactDate = bookingDate || date;
    if (exactDate) {
      const dateStr = String(exactDate).trim().slice(0, 10);
      filter.startDateTime = {
        $gte: new Date(`${dateStr}T00:00:00.000Z`),
        $lte: new Date(`${dateStr}T23:59:59.999Z`),
      };
    } else if (startDate || endDate) {
      filter.startDateTime = {};
      if (startDate) {
        filter.startDateTime.$gte = new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.startDateTime.$lte = new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`);
      }
    }

    const bookings = await populateBookingReferences(
      Booking.find(filter)
    ).sort({ startDateTime: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getBookingById
exports.getBookingById = async (req, res) => {
  try {
    const identifier = String(req.params.id).trim();
    const bookingQuery = mongoose.Types.ObjectId.isValid(identifier)
      ? { _id: identifier }
      : { bookingId: identifier };
    const booking = await populateBookingReferences(
      Booking.findOne(bookingQuery)
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const [invoice, servicePayment] = await Promise.all([
      Invoice.findOne({ bookingReference: booking._id }),
      ServicePayment.findOne({ bookingReference: booking._id }),
    ]);

    res.status(200).json({ booking, invoice, servicePayment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//previewBookingQuote
exports.previewBookingQuote = async (req, res) => {
  try {
    const {
      pricingId,
      bathroomCountId,
      serviceDurationId,
      serviceFrequencyId,
      subscriptionTypeId,
      scheduledDate,
      startTime,
      timeSlotId,
      discount,
    } = req.body;

    if (!pricingId) return res.status(400).json({ message: 'pricingId is required' });
    if (!scheduledDate) return res.status(400).json({ message: 'scheduledDate is required' });
    if (!mongoose.Types.ObjectId.isValid(pricingId)) {
      return res.status(400).json({ message: 'Invalid pricingId' });
    }

    const normalizedDateStr = String(scheduledDate).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateStr)) {
      return res.status(400).json({ message: 'scheduledDate must use YYYY-MM-DD format' });
    }

    const selectedPricing = await Pricing.findOne({
      _id: pricingId,
      bathroomCountReference: bathroomCountId,
      serviceFrequencyReference: serviceFrequencyId,
      subscriptionTypeReference: subscriptionTypeId,
      isActive: true,
    });
    if (!selectedPricing) {
      return res.status(404).json({ message: 'Active pricing record not found' });
    }

    // Resolve a start time the same way createBooking does: explicit startTime,
    // else the offset/start time carried on timeSlotId, else 00:00.
    let slotStartMinutes = null;
    if (typeof timeSlotId === 'string' && timeSlotId.includes('-')) {
      const parsedOffset = parseInt(timeSlotId.split('-')[1], 10);
      if (!isNaN(parsedOffset)) slotStartMinutes = parsedOffset;
    }
    if (startTime) {
      const parsed = availabilityService.parseTimeToMinutes(startTime);
      if (parsed !== null) slotStartMinutes = parsed;
    }
    if (slotStartMinutes === null && timeSlotId) {
      const actualTimeSlotMongoId = String(timeSlotId).split('-')[0];
      if (mongoose.Types.ObjectId.isValid(actualTimeSlotMongoId)) {
        const slot = await TimeSlot.findById(actualTimeSlotMongoId);
        if (slot) slotStartMinutes = availabilityService.parseTimeToMinutes(slot.startTime);
      }
    }
    if (slotStartMinutes === null) slotStartMinutes = 0;

    const resolvedServiceDuration = await availabilityService.resolveServiceDuration({
      pricingId,
      serviceDurationId,
      bathroomCountId,
    });

    const calculatedStartDateTime = availabilityService.combineDateAndTime(normalizedDateStr, slotStartMinutes);
    const calculatedEndDateTime = availabilityService.combineDateAndTime(normalizedDateStr, slotStartMinutes + resolvedServiceDuration);

    let normalizedTotalVisits = 1;
    if (subscriptionTypeId) {
      if (!serviceFrequencyId) {
        return res.status(400).json({ message: 'serviceFrequencyId is required for a subscription booking' });
      }

      const subscriptionType = await SubscriptionType.findOne({ _id: subscriptionTypeId, isActive: true });
      if (!subscriptionType) return res.status(404).json({ message: 'Subscription type not found' });

      const serviceFrequency = await ServiceFrequency.findOne({ _id: serviceFrequencyId, isActive: true });
      if (!serviceFrequency) return res.status(404).json({ message: 'Service frequency not found' });

      const { visitScheduleDates } = buildVisitSchedule({
        startDateTime: calculatedStartDateTime,
        endDateTime: calculatedEndDateTime,
        subscriptionType,
        serviceFrequency,
      });

      normalizedTotalVisits = visitScheduleDates.length || 1;
    }

    const paymentMaster = await PaymentMaster.findOne({
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
    }).sort({ effectiveFrom: -1 });

    if (!paymentMaster) {
      return res.status(400).json({ message: 'No active payment master configuration found' });
    }

    const breakdown = buildBillBreakdown({
      pricePerVisit: Number(selectedPricing.price),
      totalVisits: normalizedTotalVisits,
      discount,
      paymentMaster,
    });

    res.status(200).json({
      totalVisits: normalizedTotalVisits,
      pricePerVisit: Number(selectedPricing.price),
      cgstRate: paymentMaster.cgstRate,
      sgstRate: paymentMaster.sgstRate,
      ...breakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateBookingPaymentAccount
exports.updateBookingPaymentAccount = async (req, res) => {
  const { id } = req.params;
  const { paymentAccountId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid booking ID' });
  }
  if (!paymentAccountId || !mongoose.Types.ObjectId.isValid(paymentAccountId)) {
    return res.status(400).json({ message: 'Valid paymentAccountId is required' });
  }

  const userId = getUserObjectId(req);
  const session = await mongoose.startSession();
  let updatedBooking = null;

  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        const error = new Error('Booking not found');
        error.status = 404;
        throw error;
      }

      const paymentAccount = await PaymentAccount.findOne({
        _id: paymentAccountId,
        isActive: true,
      }).session(session);

      if (!paymentAccount) {
        const error = new Error('Active payment account not found');
        error.status = 404;
        throw error;
      }

      const servicePayment = await ServicePayment.findOne({
        bookingReference: booking._id,
      }).session(session);

      if (!servicePayment) {
        const error = new Error('Service payment not found for this booking');
        error.status = 404;
        throw error;
      }

      const previousBooking = booking.toObject();
      const previousServicePayment = servicePayment.toObject();

      booking.paymentAccountReference = paymentAccount._id;
      servicePayment.paymentAccountReference = paymentAccount._id;

      updatedBooking = await booking.save({ session });
      const updatedServicePayment = await servicePayment.save({ session });

      await BookingLog.create([{
        operation: 'UPDATE',
        actionBy: userId,
        bookingId: updatedBooking._id,
        details: { action: 'Booking payment account updated' },
        previousValue: previousBooking,
        newValue: updatedBooking.toObject(),
      }], { session });

      await ServicePaymentLog.create([{
        operation: 'UPDATE',
        actionBy: userId,
        servicePaymentId: updatedServicePayment._id,
        details: { action: 'Service payment account updated' },
        previousValue: previousServicePayment,
        newValue: updatedServicePayment.toObject(),
      }], { session });
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  } finally {
    await session.endSession();
  }

  const populatedBooking = await populateBookingReferences(
    Booking.findById(updatedBooking._id)
  );
  return res.status(200).json(populatedBooking);
};

//updateBookingStatus
const updateBookingStatus = async (req, res, statusName, extraFields = {}) => {
  try {
    const normalizedStatus = statusName.toLowerCase();
    const lifecycleFields = normalizedStatus === 'cancelled'
      ? { isPending: false, isCompleted: false, isCancelled: true, isActive: false }
      : normalizedStatus === 'completed'
        ? { isPending: false, isCompleted: true, isCancelled: false, isActive: true }
        : { isPending: true, isCompleted: false, isCancelled: false, isActive: true };

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { ...lifecycleFields, ...extraFields },
      { new: true, runValidators: true }
    );

    if (!booking) {
      if (normalizedStatus === 'completed') {
        const visit = await Visit.findByIdAndUpdate(
          req.params.id,
          { isPending: false, isCompleted: true, isCancelled: false, actualEndDateTime: new Date() },
          { new: true, runValidators: true }
        );
        if (visit) return res.status(200).json(visit);
      }
      return res.status(404).json({ message: 'Booking not found' });
    }

    await Subscription.findOneAndUpdate(
      { bookingReference: booking._id },
      { ...lifecycleFields, subscriptionStatus: statusName === 'Scheduled' ? 'Upcoming' : statusName },
      { runValidators: true }
    );

    const userId = getUserObjectId(req);
    await BookingLog.create({
      operation: 'UPDATE',
      actionBy: userId,
      bookingId: booking._id,
      details: { action: `Booking marked ${statusName}` },
      previousValue: null,
      newValue: booking.toObject(),
    });

    const populatedBooking = await populateBookingReferences(Booking.findById(booking._id));
    res.status(200).json(populatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//cancelBooking
exports.cancelBooking = (req, res) => updateBookingStatus(req, res, 'Cancelled');

//restoreBooking
exports.restoreBooking = (req, res) => updateBookingStatus(req, res, 'Scheduled');

//completeBooking
exports.completeBooking = (req, res) =>
  updateBookingStatus(req, res, 'Completed', {
    completionPhoto: req.body.completionPhoto || null,
  });

//deleteBooking
exports.deleteBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    await Invoice.findOneAndDelete({ bookingReference: booking._id });

    const userId = getUserObjectId(req);
    await BookingLog.create({
      operation: 'DELETE',
      actionBy: userId,
      bookingId: booking._id,
      details: { action: 'Booking and associated invoice deleted' },
      previousValue: booking.toObject(),
      newValue: null,
    });

    res.status(200).json({ message: 'Booking and associated invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getDate
const getDate = (date = new Date()) => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

//addCalendarMonths
const addCalendarMonths = (date, months) => {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

//getUserObjectId
const getUserObjectId = (req) => {
  if (!req.user) return null;
  const userId = req.user._id || req.user.id || req.user.userId || null;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return userId;
};

//populateBookingReferences
const populateBookingReferences = (query) => {
  return query
    .populate('customerReference')
    .populate('bathroomCountReference')
    .populate('pricingReference')
    .populate('serviceFrequencyReference')
    .populate('subscriptionTypeReference')
    .populate('timeSlotReference')
    .populate('paymentMethodReference')
    .populate('paymentAccountReference');
};

//roundCurrency
const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

//buildVisitSchedule
const buildVisitSchedule = ({ startDateTime, endDateTime, subscriptionType, serviceFrequency }) => {
  const scheduleIntervalDays = Number(serviceFrequency.intervalDays) || 7;
  const subscriptionDurationMonths = Number(subscriptionType.timeGap) || 1;
  const subscriptionEndDate = addCalendarMonths(startDateTime, subscriptionDurationMonths);
  const visitDuration = endDateTime.getTime() - startDateTime.getTime();
  const isMonthlyFrequency = scheduleIntervalDays >= 28;
  // Keep the schedule count consistent with the frontend quote:
  // term months multiplied by the frequency's visits per month.
  const totalScheduledVisits = Math.max(
    1,
    subscriptionDurationMonths * Math.max(1, Math.round(30 / scheduleIntervalDays))
  );

  const visitScheduleDates = [];
  let currentVisitStart = new Date(startDateTime);
  let visitMonthOffset = 0;

  while (
    currentVisitStart < subscriptionEndDate &&
    visitScheduleDates.length < totalScheduledVisits
  ) {
    visitScheduleDates.push({
      scheduledStartDateTime: new Date(currentVisitStart),
      scheduledEndDateTime: new Date(currentVisitStart.getTime() + visitDuration),
    });

    if (isMonthlyFrequency) {
      // Advance by one calendar month per visit interval
      visitMonthOffset += Math.round(scheduleIntervalDays / 30) || 1;
      currentVisitStart = addCalendarMonths(startDateTime, visitMonthOffset);
    } else {
      const nextVisitStart = new Date(currentVisitStart);
      nextVisitStart.setUTCDate(nextVisitStart.getUTCDate() + scheduleIntervalDays);
      currentVisitStart = nextVisitStart;
    }
  }

  return { visitScheduleDates, subscriptionEndDate, scheduleIntervalDays };
};

//buildBillBreakdown
const buildBillBreakdown = ({ pricePerVisit, totalVisits, discount, paymentMaster }) => {
  const mappedFinalAmount = roundCurrency(pricePerVisit);
  const requestedDiscountAmount = roundCurrency(Math.max(0, Number(discount) || 0));
  const discountAmount = roundCurrency(Math.min(requestedDiscountAmount, mappedFinalAmount));
  const totalAmount = roundCurrency(mappedFinalAmount - discountAmount);
  const gstRate = Number(paymentMaster.cgstRate) + Number(paymentMaster.sgstRate);
  const gstAmount = gstRate > 0 ? roundCurrency(totalAmount * gstRate / (100 + gstRate)) : 0;
  const baseAmount = roundCurrency(totalAmount - gstAmount);
  const cgstAmount = roundCurrency(gstAmount / 2);
  const sgstAmount = roundCurrency(gstAmount / 2);

  return {
    baseAmount,
    taxableAmount: baseAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    totalBeforeDiscount: mappedFinalAmount,
    subtotalBeforeDiscount: mappedFinalAmount,
    discountAmount,
    totalAfterDiscount: totalAmount,
    totalAmount,
  };
};
