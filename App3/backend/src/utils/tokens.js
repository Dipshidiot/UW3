import jwt from 'jsonwebtoken';

export const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET || 'development-secret',
    {
      expiresIn: '7d',
    },
  );
