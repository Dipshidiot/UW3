import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'buyer'],
      default: 'user',
    },
    region: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'unassigned',
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    streakCount: {
      type: Number,
      default: 0,
    },
    preferredUtilities: {
      type: [
        {
          type: String,
          enum: ['electricity', 'water', 'gas', 'trash'],
        },
      ],
      default: ['electricity', 'water', 'gas', 'trash'],
    },
    preferredProviders: {
      electricity: { type: String, trim: true, default: '' },
      water: { type: String, trim: true, default: '' },
      gas: { type: String, trim: true, default: '' },
      trash: { type: String, trim: true, default: '' },
    },
    buyerAccess: {
      enabled: {
        type: Boolean,
        default: false,
      },
      pinHash: {
        type: String,
        default: '',
      },
      apiKeyHash: {
        type: String,
        default: '',
      },
      keyPrefix: {
        type: String,
        default: '',
      },
      lastAuthenticatedAt: {
        type: Date,
        default: null,
      },
      lastRotatedAt: {
        type: Date,
        default: null,
      },
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    adminAccessRevokedAt: {
      type: Date,
      default: null,
    },
    rewardHistory: [
      {
        source: { type: String, default: 'monthly-entry' },
        month: { type: Number },
        year: { type: Number },
        pointsEarned: { type: Number, default: 0 },
        cashValue: { type: Number, default: 0 },
        balanceAfter: { type: Number, default: 0 },
        description: { type: String, default: '' },
        paidUtilities: [{ type: String }],
        breakdown: [
          {
            label: { type: String, required: true },
            amount: { type: Number, required: true },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    badges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
      },
    ],
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
