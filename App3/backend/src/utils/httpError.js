export const createHttpError = (statusCode, message, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
};
