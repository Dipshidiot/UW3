import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import app from '../app.js';
import AggregatedUsage from '../models/AggregatedUsage.js';
import Badge from '../models/Badge.js';
import BuyerAccessLog from '../models/BuyerAccessLog.js';
import CategorySpendTrend from '../models/CategorySpendTrend.js';
import MonthlySummary from '../models/MonthlySummary.js';
import Notification from '../models/Notification.js';
import ProviderTrend from '../models/ProviderTrend.js';
import RegionalStat from '../models/RegionalStat.js';
import Reward from '../models/Reward.js';
import User from '../models/User.js';
import UtilityEntry from '../models/UtilityEntry.js';
import { connectInsightsDatabase, closeInsightsDatabase } from '../config/insightsDb.js';
import { ensureBadgeCatalog } from '../services/badgeService.js';
import { signToken } from '../utils/tokens.js';

let mongoServer;

const buildEntryPayload = (date, overrides = {}) => {
  const paidUtilities = overrides.paidUtilities ?? ['electricity', 'water', 'gas', 'trash'];
  const mergedCategories = {
    electricity: 210,
    water: 85,
    gas: 60,
    trash: 30,
    ...(overrides.categories || {}),
  };

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    paidUtilities,
    categories: {
      electricity: paidUtilities.includes('electricity') ? mergedCategories.electricity : 0,
      water: paidUtilities.includes('water') ? mergedCategories.water : 0,
      gas: paidUtilities.includes('gas') ? mergedCategories.gas : 0,
      trash: paidUtilities.includes('trash') ? mergedCategories.trash : 0,
    },
    notes: overrides.notes || 'Integration test utility entry.',
  };
};

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.DEMO_MODE_ONLY = 'false';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.AGGREGATION_MONGO_URI = mongoServer.getUri();
  process.env.AGGREGATION_DB_NAME = 'utility-watch-insights-tests';

  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'utility-watch-tests',
  });

  await connectInsightsDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await closeInsightsDatabase();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    UtilityEntry.deleteMany({}),
    Notification.deleteMany({}),
    Badge.deleteMany({}),
    Reward.deleteMany({}),
    BuyerAccessLog.deleteMany({}),
    AggregatedUsage.deleteMany({}),
    RegionalStat.deleteMany({}),
    ProviderTrend.deleteMany({}),
    MonthlySummary.deleteMany({}),
    CategorySpendTrend.deleteMany({}),
  ]);
});

test('achievement catalog includes 25 total achievements with five level milestones', async () => {
  const catalog = await ensureBadgeCatalog();
  const levelKeys = catalog.filter((item) => item.key.startsWith('level-')).map((item) => item.key).sort();

  assert.equal(catalog.length, 25);
  assert.deepEqual(levelKeys, ['level-10', 'level-15', 'level-20', 'level-25', 'level-5']);
  assert.ok(catalog.every((item) => /achievement/i.test(item.name)));
});

test('registers a user and returns a usable token', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Taylor Watts',
    email: 'taylor@example.com',
    password: 'Secret123!',
  });

  assert.equal(registerResponse.statusCode, 201);
  assert.ok(registerResponse.body.token);
  assert.equal(registerResponse.body.user.email, 'taylor@example.com');
  assert.equal(registerResponse.body.user.role, 'user');
  assert.deepEqual(registerResponse.body.user.preferredUtilities, ['electricity', 'water', 'gas', 'trash']);

  const meResponse = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${registerResponse.body.token}`);

  assert.equal(meResponse.statusCode, 200);
  assert.equal(meResponse.body.user.name, 'Taylor Watts');
  assert.deepEqual(meResponse.body.user.preferredUtilities, ['electricity', 'water', 'gas', 'trash']);
});

test('allows current and previous month submissions but rejects older months', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Casey Flow',
    email: 'casey@example.com',
    password: 'Secret123!',
  });

  const token = registerResponse.body.token;
  const authHeader = { Authorization: `Bearer ${token}` };

  const now = new Date();
  const currentMonthResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(
      buildEntryPayload(now, {
        paidUtilities: ['electricity', 'water'],
        categories: { electricity: 210, water: 85 },
        notes: 'Current month entry.',
      }),
    );

  assert.equal(currentMonthResponse.statusCode, 201);
  assert.equal(currentMonthResponse.body.entry.month, now.getMonth() + 1);
  assert.equal(currentMonthResponse.body.progression.rewards.totalPoints, 75);
  const currentUtilityPoints = currentMonthResponse.body.progression.rewards.items
    .filter((item) => /entry submitted/i.test(item.label))
    .reduce((sum, item) => sum + item.amount, 0);
  assert.equal(currentUtilityPoints, 65);
  const currentRewardLabels = currentMonthResponse.body.progression.rewards.items
    .map((item) => item.label)
    .join(' | ');
  assert.match(currentRewardLabels, /Electricity|Water|First Spark/i);
  assert.doesNotMatch(currentRewardLabels, /Gas|Trash|Internet/i);

  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(
      buildEntryPayload(previousMonth, {
        paidUtilities: ['electricity', 'water', 'gas'],
        categories: { electricity: 220, water: 88, gas: 63 },
        notes: 'Previous month entry.',
      }),
    );

  assert.equal(previousMonthResponse.statusCode, 201);
  const previousUtilityPoints = previousMonthResponse.body.progression.rewards.items
    .filter((item) => /entry submitted/i.test(item.label))
    .reduce((sum, item) => sum + item.amount, 0);
  assert.equal(previousUtilityPoints, 65);

  const olderMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const olderMonthResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(buildEntryPayload(olderMonth, { notes: 'This should be rejected.' }));

  assert.equal(olderMonthResponse.statusCode, 400);
  assert.match(
    olderMonthResponse.body.message,
    /current month or the previous month/i,
  );

  const profileResponse = await request(app)
    .get('/api/profile')
    .set(authHeader);

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.body.summary.totalEntries, 2);
  assert.equal(profileResponse.body.user.rewardPoints, 160);
  assert.deepEqual(profileResponse.body.user.preferredUtilities, ['electricity', 'water', 'gas']);

  const rewardsResponse = await request(app)
    .get('/api/rewards')
    .set(authHeader);

  assert.equal(rewardsResponse.statusCode, 200);
  assert.deepEqual(rewardsResponse.body.preferredUtilities, ['electricity', 'water', 'gas']);
  const transparencyText = rewardsResponse.body.transparency.factors.join(' | ');
  assert.match(transparencyText, /Electricity submission|Water submission|Gas submission/i);
  assert.doesNotMatch(transparencyText, /Trash \/ Waste submission/i);
});

test('stores provider details for each selected utility entry', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Provider Saver',
    email: 'provider-saver@example.com',
    password: 'Secret123!',
  });

  const authHeader = { Authorization: `Bearer ${registerResponse.body.token}` };
  const now = new Date();
  const createResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send({
      ...buildEntryPayload(now, {
        paidUtilities: ['electricity', 'water', 'trash'],
        categories: { electricity: 208, water: 82, gas: 0, trash: 26 },
        notes: 'Provider details included.',
      }),
      providers: {
        electricity: 'NorthGrid Power',
        water: 'ClearFlow Water',
        trash: 'City Waste Services',
      },
    });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.body.entry.providers.electricity, 'NorthGrid Power');
  assert.equal(createResponse.body.entry.providers.water, 'ClearFlow Water');
  assert.equal(createResponse.body.entry.providers.trash, 'City Waste Services');

  const meResponse = await request(app)
    .get('/api/auth/me')
    .set(authHeader);

  assert.equal(meResponse.statusCode, 200);
  assert.equal(meResponse.body.user.preferredProviders.electricity, 'NorthGrid Power');
  assert.equal(meResponse.body.user.preferredProviders.water, 'ClearFlow Water');

  const profileResponse = await request(app)
    .get('/api/profile')
    .set(authHeader);

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.body.user.preferredProviders.electricity, 'NorthGrid Power');
  assert.equal(profileResponse.body.user.preferredProviders.water, 'ClearFlow Water');
  assert.equal(profileResponse.body.history.at(-1).providers.electricity, 'NorthGrid Power');
  assert.equal(profileResponse.body.history.at(-1).providers.water, 'ClearFlow Water');
});

test('lets a user correct a saved current-month entry', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Jamie Correct',
    email: 'jamie@example.com',
    password: 'Secret123!',
  });

  const authHeader = { Authorization: `Bearer ${registerResponse.body.token}` };
  const now = new Date();
  const createResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(
      buildEntryPayload(now, {
        paidUtilities: ['electricity', 'water'],
        categories: { electricity: 210, water: 85 },
        notes: 'Original entry.',
      }),
    );

  assert.equal(createResponse.statusCode, 201);

  const updateResponse = await request(app)
    .put(`/api/entries/${createResponse.body.entry.id}`)
    .set(authHeader)
    .send({
      paidUtilities: ['electricity', 'water', 'trash'],
      categories: { electricity: 205, water: 81, gas: 0, trash: 24 },
      notes: 'Corrected after a mistake.',
    });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.body.entry.totalUsage, 310);
  assert.deepEqual(updateResponse.body.entry.paidUtilities, ['electricity', 'water', 'trash']);
  assert.equal(updateResponse.body.entry.notes, 'Corrected after a mistake.');

  const profileResponse = await request(app)
    .get('/api/profile')
    .set(authHeader);

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.body.history.at(-1).notes, 'Corrected after a mistake.');
});

test('only lets bill selection change for the current month', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Parker Month',
    email: 'parker@example.com',
    password: 'Secret123!',
  });

  const authHeader = { Authorization: `Bearer ${registerResponse.body.token}` };
  const previousMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const createResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(
      buildEntryPayload(previousMonth, {
        paidUtilities: ['electricity', 'water'],
        categories: { electricity: 220, water: 90 },
        notes: 'Previous month original entry.',
      }),
    );

  assert.equal(createResponse.statusCode, 201);

  const updateResponse = await request(app)
    .put(`/api/entries/${createResponse.body.entry.id}`)
    .set(authHeader)
    .send({
      paidUtilities: ['electricity', 'water', 'trash'],
      categories: { electricity: 218, water: 88, gas: 0, trash: 26 },
      notes: 'Trying to change bills on a previous month entry.',
    });

  assert.equal(updateResponse.statusCode, 400);
  assert.match(updateResponse.body.message, /only current-month entries can change which bills you pay/i);
});

test('re-submitting the same period updates the saved entry instead of failing', async () => {
  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Morgan Dupes',
    email: 'morgan@example.com',
    password: 'Secret123!',
  });

  const authHeader = { Authorization: `Bearer ${registerResponse.body.token}` };
  const now = new Date();
  const firstPayload = buildEntryPayload(now, {
    paidUtilities: ['electricity', 'water'],
    categories: { electricity: 210, water: 85 },
    notes: 'Original submission.',
  });
  const secondPayload = buildEntryPayload(now, {
    paidUtilities: ['electricity', 'water', 'trash'],
    categories: { electricity: 205, water: 81, trash: 24 },
    notes: 'Corrected submission.',
  });

  const firstResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(firstPayload);

  const secondResponse = await request(app)
    .post('/api/entries')
    .set(authHeader)
    .send(secondPayload);

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(secondResponse.statusCode, 200);
  assert.match(secondResponse.body.message, /updated successfully/i);
  assert.deepEqual(secondResponse.body.entry.paidUtilities, ['electricity', 'water', 'trash']);
  assert.equal(secondResponse.body.entry.notes, 'Corrected submission.');
  assert.equal(secondResponse.body.entry.totalUsage, 310);

  const entriesResponse = await request(app)
    .get('/api/entries')
    .set(authHeader);

  assert.equal(entriesResponse.statusCode, 200);
  assert.equal(entriesResponse.body.entries.length, 1);
});

test('first admin login requires a password change before admin tools unlock', async () => {
  const admin = await User.create({
    name: 'First Login Admin',
    email: 'first-admin@example.com',
    password: 'Secret123!',
    role: 'admin',
    region: 'hq',
    mustChangePassword: true,
  });

  const authHeader = { Authorization: `Bearer ${signToken(admin)}` };
  const blockedAdminResponse = await request(app)
    .get('/api/admin/overview')
    .set(authHeader);

  assert.equal(blockedAdminResponse.statusCode, 403);
  assert.match(blockedAdminResponse.body.message, /change your admin password before using admin tools/i);

  const passwordChangeResponse = await request(app)
    .put('/api/auth/password')
    .set(authHeader)
    .send({
      newPassword: 'NewSecret456!',
    });

  assert.equal(passwordChangeResponse.statusCode, 200);
  assert.equal(passwordChangeResponse.body.user.role, 'admin');
  assert.equal(passwordChangeResponse.body.user.mustChangePassword, false);
  assert.equal(passwordChangeResponse.body.requiresRelogin, true);
  assert.match(passwordChangeResponse.body.message, /sign in again to restore your admin buttons and tools/i);

  const refreshedUser = await User.findById(admin._id).lean();
  assert.equal(refreshedUser.role, 'admin');
  assert.equal(refreshedUser.mustChangePassword, false);

  const adminRouteResponse = await request(app)
    .get('/api/admin/overview')
    .set(authHeader);

  assert.equal(adminRouteResponse.statusCode, 200);
});

test('admin can toggle demo preview mode from the admin controls', async () => {
  process.env.DEMO_MODE_ONLY = 'false';

  try {
    const admin = await User.create({
      name: 'Mode Toggle Admin',
      email: 'mode-toggle-admin@example.com',
      password: 'Secret123!',
      role: 'admin',
      region: 'hq',
    });

    const authHeader = { Authorization: `Bearer ${signToken(admin)}` };
    const enableResponse = await request(app)
      .put('/api/admin/app-mode')
      .set(authHeader)
      .send({ demoModeOnly: true });

    assert.equal(enableResponse.statusCode, 200);
    assert.equal(enableResponse.body.appMode.demoModeOnly, true);

    const blockedRegister = await request(app).post('/api/auth/register').send({
      name: 'Blocked By Toggle',
      email: 'blocked-by-toggle@example.com',
      password: 'Secret123!',
    });

    assert.equal(blockedRegister.statusCode, 403);

    const disableResponse = await request(app)
      .put('/api/admin/app-mode')
      .set(authHeader)
      .send({ demoModeOnly: false });

    assert.equal(disableResponse.statusCode, 200);
    assert.equal(disableResponse.body.appMode.demoModeOnly, false);
  } finally {
    process.env.DEMO_MODE_ONLY = 'false';
  }
});

test('demo-only mode blocks live member access but still allows admin testing login', async () => {
  process.env.DEMO_MODE_ONLY = 'true';

  try {
    const registerResponse = await request(app).post('/api/auth/register').send({
      name: 'Blocked Demo User',
      email: 'blocked-demo@example.com',
      password: 'Secret123!',
    });

    assert.equal(registerResponse.statusCode, 403);
    assert.match(registerResponse.body.message, /demo mode|preview mode|disabled until launch/i);

    await User.create({
      name: 'Preview Member',
      email: 'preview-member@example.com',
      password: 'Secret123!',
      role: 'user',
      region: 'north',
    });

    const memberLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'preview-member@example.com',
      password: 'Secret123!',
    });

    assert.equal(memberLoginResponse.statusCode, 403);
    assert.match(memberLoginResponse.body.message, /demo mode|preview mode|disabled until launch/i);

    await User.create({
      name: 'Preview Admin',
      email: 'preview-admin@example.com',
      password: 'Secret123!',
      role: 'admin',
      region: 'hq',
      mustChangePassword: true,
    });

    const adminLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'preview-admin@example.com',
      password: 'Secret123!',
    });

    assert.equal(adminLoginResponse.statusCode, 200);
    assert.equal(adminLoginResponse.body.user.role, 'admin');
  } finally {
    process.env.DEMO_MODE_ONLY = 'false';
  }
});

test('buyer credentials unlock aggregated insights and write an audit trail', async () => {
  const now = new Date();
  const admin = await User.create({
    name: 'Admin Ops',
    email: 'admin-insights@example.com',
    password: 'Secret123!',
    role: 'admin',
    region: 'hq',
  });

  const households = await User.insertMany(
    Array.from({ length: 6 }, (_, index) => ({
      name: `North Household ${index + 1}`,
      email: `north-household-${index + 1}@example.com`,
      password: 'Secret123!',
      role: 'user',
      region: 'north',
    })),
  );

  await UtilityEntry.insertMany(
    households.map((user, index) => ({
      user: user._id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      paidUtilities: ['electricity', 'water', 'gas', 'trash'],
      categories: {
        electricity: 200 + index,
        water: 80 + index,
        gas: 60 + index,
        trash: 25 + index,
      },
      totalUsage: 365 + index * 4,
      notes: 'Buyer insights aggregation seed.',
    })),
  );

  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };
  const provisionResponse = await request(app)
    .post('/api/buyer/auth/provision')
    .set(adminAuth)
    .send({
      name: 'Insight Buyer',
      email: 'buyer@example.com',
      pin: '246810',
      region: 'north',
    });

  assert.equal(provisionResponse.statusCode, 201);
  assert.ok(provisionResponse.body.credentials.apiKey);

  const aggregateResponse = await request(app)
    .post('/api/buyer/auth/aggregate')
    .set(adminAuth);

  assert.equal(aggregateResponse.statusCode, 200);
  assert.equal(aggregateResponse.body.summary.monthlySummaryCount >= 1, true);

  const usageResponse = await request(app)
    .get(`/api/insights/usage/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
    .set('x-api-key', provisionResponse.body.credentials.apiKey);

  assert.equal(usageResponse.statusCode, 200);
  assert.equal(usageResponse.body.meta.scope, 'aggregated');
  assert.equal(Array.isArray(usageResponse.body.data), true);
  assert.equal(usageResponse.body.data[0].householdCount, 6);
  assert.equal('userId' in usageResponse.body.data[0], false);
  assert.equal('email' in usageResponse.body.data[0], false);

  const logs = await BuyerAccessLog.find().lean();
  assert.equal(logs.length, 1);
  assert.match(logs[0].endpoint, /\/api\/insights\/usage\/monthly/i);
  assert.equal(logs[0].apiKeyPrefix.length > 0, true);
});

test('admin provisioning can auto-generate buyer credentials and store the access record', async () => {
  const admin = await User.create({
    name: 'Admin Keys',
    email: 'admin-keys@example.com',
    password: 'Secret123!',
    role: 'admin',
    region: 'hq',
  });

  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };
  const provisionResponse = await request(app)
    .post('/api/buyer/auth/provision')
    .set(adminAuth)
    .send({
      name: 'Generated Buyer',
      email: 'generated-buyer@example.com',
      region: 'north',
      autoGenerateCredentials: true,
    });

  assert.equal(provisionResponse.statusCode, 201);
  assert.ok(provisionResponse.body.credentials.apiKey);
  assert.ok(provisionResponse.body.credentials.pin);
  assert.match(provisionResponse.body.credentials.apiKey, /^buyer_[a-f0-9]+\.[a-f0-9]+$/i);
  assert.match(provisionResponse.body.credentials.pin, /^\d{6}$/);

  const buyer = await User.findOne({ email: 'generated-buyer@example.com' }).lean();
  assert.equal(buyer.role, 'buyer');
  assert.equal(Boolean(buyer.buyerAccess?.enabled), true);
  assert.equal(Boolean(buyer.buyerAccess?.pinHash), true);
  assert.equal(Boolean(buyer.buyerAccess?.apiKeyHash), true);
});

test('buyer insights reject drilldown filters and blocked raw-identifying parameters', async () => {
  const now = new Date();
  const admin = await User.create({
    name: 'Admin Guard',
    email: 'admin-guard@example.com',
    password: 'Secret123!',
    role: 'admin',
    region: 'hq',
  });

  const households = await User.insertMany(
    Array.from({ length: 4 }, (_, index) => ({
      name: `South Household ${index + 1}`,
      email: `south-household-${index + 1}@example.com`,
      password: 'Secret123!',
      role: 'user',
      region: 'south',
    })),
  );

  await UtilityEntry.insertMany(
    households.map((user, index) => ({
      user: user._id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      paidUtilities: ['electricity', 'water'],
      categories: {
        electricity: 180 + index,
        water: 70 + index,
        gas: 0,
        trash: 0,
      },
      totalUsage: 250 + index * 3,
      notes: 'Small cohort for privacy threshold test.',
    })),
  );

  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };
  const provisionResponse = await request(app)
    .post('/api/buyer/auth/provision')
    .set(adminAuth)
    .send({
      name: 'South Buyer',
      email: 'south-buyer@example.com',
      pin: '135790',
      region: 'south',
    });

  assert.equal(provisionResponse.statusCode, 201);

  await request(app)
    .post('/api/buyer/auth/aggregate')
    .set(adminAuth)
    .expect(200);

  const rawFilterResponse = await request(app)
    .get('/api/insights/usage/monthly?userId=abc123')
    .set('x-api-key', provisionResponse.body.credentials.apiKey);

  assert.equal(rawFilterResponse.statusCode, 400);
  assert.match(rawFilterResponse.body.message, /blocked filter|raw identifiers/i);

  const drilldownResponse = await request(app)
    .get(`/api/insights/usage/region?region=south&month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
    .set('x-api-key', provisionResponse.body.credentials.apiKey);

  assert.equal(drilldownResponse.statusCode, 403);
  assert.match(drilldownResponse.body.message, /minimum privacy threshold|at least 5 households/i);
});
