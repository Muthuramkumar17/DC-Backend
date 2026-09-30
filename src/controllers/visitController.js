const mongoose = require('mongoose');
const Visit = require('../models/visit');
const Booking = require('../models/Booking');
const Subscription = require('../models/subscription');
const BookingLog = require('../models/AuditLog');

//populateVisitReferences
const populateVisitReferences = (query) => {
  return query
    .populate('subscriptionReference')
    .populate({
      path: 'bookingReference',
      populate: [
        { path: 'bathroomCountReference' },
        { path: 'pricingReference' },
        { path: 'serviceDurationReference' },
        { path: 'serviceFrequencyReference' },
        { path: 'subscriptionTypeReference' },
        { path: 'timeSlotReference' },
        { path: 'paymentMethodReference' },
        { path: 'paymentAccountReference' },
        { path: 'customerReference' },
      ],
    })
    .populate('customerReference')
    .populate('timeSlotReference')
    .populate({
      path: 'createdBy',
      select: 'userId userName email roleReference isActive',
      populate: {
        path: 'roleReference',
        select: 'roleId roleName isActive',
      },
    })
    .populate({
      path: 'updatedBy',
      select: 'userId userName email roleReference isActive',
      populate: {
        path: 'roleReference',
        select: 'roleId roleName isActive',
      },
    });
};

//getAllVisits
exports.getAllVisits = async (req, res) => {
  try {
    const filter = {};

    if (req.query.subscriptionReference) {
      filter.subscriptionReference = req.query.subscriptionReference;
    }

    if (req.query.customerReference) {
      filter.customerReference = req.query.customerReference;
    }

    if (req.query.isCompleted !== undefined) {
      filter.isCompleted = req.query.isCompleted === 'true';
    }

    const visits = await populateVisitReferences(
      Visit.find(filter)
    ).sort({ scheduledStartDateTime: 1 });

    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getVisitById
exports.getVisitById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid visit ID',
      });
    }

    const visit = await populateVisitReferences(
      Visit.findById(req.params.id)
    );

    if (!visit) {
      return res.status(404).json({
        message: 'Visit not found',
      });
    }

    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateVisit
exports.updateVisit = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();

      return res.status(400).json({
        message: 'Invalid visit ID',
      });
    }

    const visit = await Visit.findById(req.params.id).session(session);

    if (!visit) {
      await session.abortTransaction();

      return res.status(404).json({
        message: 'Visit not found',
      });
    }

    const previousCompletedState = visit.isCompleted;

    const {
      actualStartDateTime,
      actualEndDateTime,
      remarks,
      isPending,
      isCompleted,
      isCancelled,
      isActive,
    } = req.body;

    const nextPending =
      isPending !== undefined ? isPending : visit.isPending;

    const nextCompleted =
      isCompleted !== undefined ? isCompleted : visit.isCompleted;

    const nextCancelled =
      isCancelled !== undefined ? isCancelled : visit.isCancelled;

    const activeStateCount = [
      nextPending,
      nextCompleted,
      nextCancelled,
    ].filter(Boolean).length;

    if (activeStateCount !== 1) {
      await session.abortTransaction();

      return res.status(400).json({
        message: 'Exactly one visit lifecycle state must be true',
      });
    }

    if (nextCompleted && (!actualStartDateTime || !actualEndDateTime)) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          'actualStartDateTime and actualEndDateTime are required when completing a visit',
      });
    }

    if (
      actualStartDateTime &&
      actualEndDateTime &&
      new Date(actualEndDateTime) <= new Date(actualStartDateTime)
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        message: 'actualEndDateTime must be after actualStartDateTime',
      });
    }

    if (actualStartDateTime !== undefined) {
      visit.actualStartDateTime = actualStartDateTime;
    }

    if (actualEndDateTime !== undefined) {
      visit.actualEndDateTime = actualEndDateTime;
    }

    if (remarks !== undefined) {
      visit.remarks = remarks;
    }

    if (isActive !== undefined) {
      visit.isActive = isActive;
    }

    visit.isPending = nextPending;
    visit.isCompleted = nextCompleted;
    visit.isCancelled = nextCancelled;
    visit.updatedBy = req.user.userId;

    await visit.save({ session });

    if (!previousCompletedState && visit.isCompleted) {
      const subscription = await Subscription.findById(
        visit.subscriptionReference
      ).session(session);

      if (!subscription) {
        throw new Error('Linked subscription not found');
      }

      subscription.completedVisits += 1;
      subscription.remainingVisits = Math.max(
        subscription.totalVisits - subscription.completedVisits,
        0
      );

      if (subscription.remainingVisits === 0) {
        subscription.subscriptionStatus = 'Completed';
        subscription.isPending = false;
        subscription.isCompleted = true;
        subscription.isCancelled = false;
      } else {
        subscription.subscriptionStatus = 'Active';
      }

      await subscription.save({ session });

      if (subscription.remainingVisits === 0) {
        const booking = await Booking.findById(
          visit.bookingReference
        ).session(session);

        if (!booking) {
          throw new Error('Linked booking not found');
        }

        const previousBookingValue = booking.toObject();

        booking.isPending = false;
        booking.isCompleted = true;
        booking.isCancelled = false;
        booking.isActive = true;

        await booking.save({ session });

        const bookingLog = new BookingLog({
          operation: 'UPDATE',
          actionBy: req.user.userId,
          bookingId: booking._id,
          details: {
            action: 'Booking marked completed after final visit completion',
          },
          previousValue: previousBookingValue,
          newValue: booking.toObject(),
        });

        await bookingLog.save({ session });
      }
    }

    if (previousCompletedState && !visit.isCompleted) {
      const subscription = await Subscription.findById(
        visit.subscriptionReference
      ).session(session);

      if (!subscription) {
        throw new Error('Linked subscription not found');
      }

      subscription.completedVisits = Math.max(
        subscription.completedVisits - 1,
        0
      );

      subscription.remainingVisits =
        subscription.totalVisits - subscription.completedVisits;

      subscription.subscriptionStatus = 'Active';
      subscription.isPending = true;
      subscription.isCompleted = false;
      subscription.isCancelled = false;

      await subscription.save({ session });
    }

    await session.commitTransaction();

    const updatedVisit = await populateVisitReferences(
      Visit.findById(visit._id)
    );

    return res.status(200).json({
      message: 'Visit updated successfully',
      visit: updatedVisit,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
