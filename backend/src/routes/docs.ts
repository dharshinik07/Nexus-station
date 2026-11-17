import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'NexusStation API',
    version: '1.0.0',
    description: 'Secure, multi-tenant backend API for NexusStation operations hub',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new freelancer account',
        tags: ['Auth'],
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  fullName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Account created' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate with email & password (optional 2FA code)',
        tags: ['Auth'],
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  totpCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Login successful' } },
      },
    },
    '/reports/dashboard': {
      get: {
        summary: 'Fetch dashboard financial KPIs, overdue items, and charts',
        tags: ['Dashboard'],
        responses: { 200: { description: 'Dashboard metrics' } },
      },
    },
    '/clients': {
      get: { summary: 'List clients', tags: ['Clients'] },
      post: { summary: 'Create new client', tags: ['Clients'] },
    },
    '/projects': {
      get: { summary: 'List projects with profitability', tags: ['Projects'] },
      post: { summary: 'Create new project', tags: ['Projects'] },
    },
    '/invoices': {
      get: { summary: 'List invoices', tags: ['Invoices'] },
      post: { summary: 'Create invoice', tags: ['Invoices'] },
    },
    '/expenses': {
      get: { summary: 'List expenses with receipt data', tags: ['Expenses'] },
      post: { summary: 'Create expense with receipt', tags: ['Expenses'] },
    },
    '/documents': {
      get: { summary: 'List encrypted vault documents', tags: ['Documents'] },
      post: { summary: 'Upload encrypted document', tags: ['Documents'] },
    },
    '/reports/financial': {
      get: { summary: 'Profit & Loss, Tax and income reports', tags: ['Reports'] },
    },
    '/settings': {
      get: { summary: 'Get business profile settings', tags: ['Settings'] },
      put: { summary: 'Update business profile', tags: ['Settings'] },
    },
  },
};

router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
