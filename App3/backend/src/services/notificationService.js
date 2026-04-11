import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const createNotification = async ({ userId, title, message, type = 'admin', metadata = {} }) => {
  return Notification.create({
    user: userId,
    title,
    message,
    type,
    metadata,
  });
};

export const broadcastAdminNotification = async ({ title, message, targetUserIds = [] }) => {
  const recipients = targetUserIds.length
    ? targetUserIds
    : (await User.find({}, '_id')).map((user) => user._id);

  if (!recipients.length) {
    return [];
  }

  const documents = recipients.map((userId) => ({
    user: userId,
    title,
    message,
    type: 'admin',
  }));

  return Notification.insertMany(documents);
};
