const role = [
  {
    roleName: "superadmin",
    canRead: true,
    canWrite: true,
    canUpdate: true,
    canDelete: true,
    isActive: true,
  },
  {
    roleName: "admin",
    canRead: true,
    canWrite: true,
    canUpdate: true,
    canDelete: false,
    isActive: true,
  },
  {
    roleName: "user",
    canRead: true,
    canWrite: false,
    canUpdate: false,
    canDelete: false,
    isActive: true,
  },
];

const defaultUser = [
  {
    name: "Super Admin",
    email: "superadmin@gmail.com",
    password: "superadmin123",
    roleName: "superadmin",
    isActive: true,
  },
  {
    name: "Admin",
    email: "admin@gmail.com",
    password: "admin123",
    roleName: "admin",
    isActive: true,
  },
  {
    name: "User",
    email: "user@gmail.com",
    password: "user123",
    roleName: "user",
    isActive: true,
  },
];

const bathroomCounts = [
  {
    bathroomCount: 1,
    isActive: true,
  },
  {
    bathroomCount: 2,
    isActive: true,
  },
  {
    bathroomCount: 3,
    isActive: true,
  },
  {
    bathroomCount: 4,
    isActive: true,
  },
];

const serviceDurations = [
  {
    durationMinutes: 30,
    isActive: true,
  },
  {
    durationMinutes: 45,
    isActive: true,
  },
  {
    durationMinutes: 60,
    isActive: true,
  },
  {
    durationMinutes: 75,
    isActive: true,
  },
];

const serviceFrequencies = [
  {
    frequencyName: "Once a Week",
    intervalDays: 7,
    isActive: true,
  },
  {
    frequencyName: "Once in 2 Weeks",
    intervalDays: 14,
    isActive: true,
  },
  {
    frequencyName: "Once a Month",
    intervalDays: 30,
    isActive: false,
  },
];

const subscriptionTypes = [
  {
    subscriptionName: "2 Months",
    timeGap: 2,
    isActive: true,
  },
  {
    subscriptionName: "3 Months",
    timeGap: 3,
    isActive: true,
  },
  {
    subscriptionName: "6 Months",
    timeGap: 6,
    isActive: true,
  },
  {
    subscriptionName: "12 Months",
    timeGap: 12,
    isActive: false,
  },
];

const timeSlots = [
  {
    startTime: "08:30 AM",
    endTime: "06:30 PM",
    bufferTime: 30,
    isActive: true,
  },
];

const paymentMethods = [
  {
    paymentMethodName: "UPI",
    isActive: true,
  },
  {
    paymentMethodName: "Cash",
    isActive: true,
  },
];

const paymentAccounts = [
  {
    accountName: "HDFC",
    isActive: true,
  },
  {
    accountName: "ICICI",
    isActive: true,
  },
];

const paymentMaster = {
  cgstRate: 9,
  sgstRate: 9,
  discountRate: 0,
  isActive: true,
};

const pricing = [
  { bathroomCount: 1, frequencyName: "Once a Week", subscriptionName: "2 Months", price: 2614, isActive: true },
  { bathroomCount: 1, frequencyName: "Once a Week", subscriptionName: "3 Months", price: 3900, isActive: true },
  { bathroomCount: 1, frequencyName: "Once a Week", subscriptionName: "6 Months", price: 7799, isActive: true },
  { bathroomCount: 1, frequencyName: "Once in 2 Weeks", subscriptionName: "2 Months", price: 1652, isActive: true },
  { bathroomCount: 1, frequencyName: "Once in 2 Weeks", subscriptionName: "3 Months", price: 2500, isActive: true },
  { bathroomCount: 1, frequencyName: "Once in 2 Weeks", subscriptionName: "6 Months", price: 4999, isActive: true },
  { bathroomCount: 2, frequencyName: "Once a Week", subscriptionName: "2 Months", price: 3965, isActive: true },
  { bathroomCount: 2, frequencyName: "Once a Week", subscriptionName: "3 Months", price: 6000, isActive: true },
  { bathroomCount: 2, frequencyName: "Once a Week", subscriptionName: "6 Months", price: 11999, isActive: true },
  { bathroomCount: 2, frequencyName: "Once in 2 Weeks", subscriptionName: "2 Months", price: 2950, isActive: true },
  { bathroomCount: 2, frequencyName: "Once in 2 Weeks", subscriptionName: "3 Months", price: 4450, isActive: true },
  { bathroomCount: 2, frequencyName: "Once in 2 Weeks", subscriptionName: "6 Months", price: 8549, isActive: true },
  { bathroomCount: 3, frequencyName: "Once a Week", subscriptionName: "2 Months", price: 5682, isActive: true },
  { bathroomCount: 3, frequencyName: "Once a Week", subscriptionName: "3 Months", price: 8600, isActive: true },
  { bathroomCount: 3, frequencyName: "Once a Week", subscriptionName: "6 Months", price: 17200, isActive: true },
  { bathroomCount: 3, frequencyName: "Once in 2 Weeks", subscriptionName: "2 Months", price: 4125, isActive: true },
  { bathroomCount: 3, frequencyName: "Once in 2 Weeks", subscriptionName: "3 Months", price: 6250, isActive: true },
  { bathroomCount: 3, frequencyName: "Once in 2 Weeks", subscriptionName: "6 Months", price: 12451, isActive: true },
  { bathroomCount: 4, frequencyName: "Once a Week", subscriptionName: "2 Months", price: 7175, isActive: true },
  { bathroomCount: 4, frequencyName: "Once a Week", subscriptionName: "3 Months", price: 10899, isActive: true },
  { bathroomCount: 4, frequencyName: "Once a Week", subscriptionName: "6 Months", price: 21541, isActive: true },
  { bathroomCount: 4, frequencyName: "Once in 2 Weeks", subscriptionName: "2 Months", price: 5305, isActive: true },
  { bathroomCount: 4, frequencyName: "Once in 2 Weeks", subscriptionName: "3 Months", price: 7999, isActive: true },
  { bathroomCount: 4, frequencyName: "Once in 2 Weeks", subscriptionName: "6 Months", price: 15999, isActive: true },
];

module.exports = {
  role,
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
};
