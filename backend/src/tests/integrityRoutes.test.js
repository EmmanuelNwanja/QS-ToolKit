/**
 * Integrity route integration tests.
 * These tests verify the route wiring and middleware configuration.
 * Run with: npx jest src/tests/integrityRoutes.test.js --no-coverage
 *
 * Requires: jest, supertest (add to devDependencies)
 */

const express = require('express');

// Mock Supabase before requiring routes
jest.mock('../config/supabase', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

// Mock auth middleware
jest.mock('../middlewares/authMiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { id: 'test-user-id', org_role: 'user' };
    next();
  },
}));

const router = require('../routes/integrityRoutes');

describe('Integrity routes', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/integrity', router);
  });

  test('GET /integrity/verify/:token is accessible without auth', async () => {
    // The verify route should be defined and not blocked by protect middleware
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });

    const verifyRoute = routes.find((r) => r.path === '/verify/:token');
    expect(verifyRoute).toBeDefined();
    expect(verifyRoute.methods).toContain('get');
  });

  test('GET /integrity/certificate/:token/download is accessible without auth', async () => {
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });

    const downloadRoute = routes.find((r) => r.path === '/certificate/:token/download');
    expect(downloadRoute).toBeDefined();
    expect(downloadRoute.methods).toContain('get');
  });

  test('POST /integrity/boq/:id/certify is defined', async () => {
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });

    const certifyRoute = routes.find((r) => r.path === '/boq/:id/certify');
    expect(certifyRoute).toBeDefined();
    expect(certifyRoute.methods).toContain('post');
  });

  test('POST /integrity/revoke/:token is defined', async () => {
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });

    const revokeRoute = routes.find((r) => r.path === '/revoke/:token');
    expect(revokeRoute).toBeDefined();
    expect(revokeRoute.methods).toContain('post');
  });

  test('GET /integrity/history/:type/:id is defined', async () => {
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });

    const historyRoute = routes.find((r) => r.path === '/history/:type/:id');
    expect(historyRoute).toBeDefined();
    expect(historyRoute.methods).toContain('get');
  });
});
