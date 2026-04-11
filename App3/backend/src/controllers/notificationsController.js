import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json({ notifications });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json({ notification });
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return next(error);
  }
};
