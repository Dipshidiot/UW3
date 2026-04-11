export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    message: err.message || 'Unexpected server error.',
    details: err.details,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
