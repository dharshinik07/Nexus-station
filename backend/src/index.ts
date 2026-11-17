import { app } from './app.js';
import { ENV } from './config/env.js';
import { prisma } from './utils/prisma.js';

const PORT = ENV.PORT || 5000;

async function bootstrap() {
  try {
    // Attempt DB connectivity check
    try {
      await prisma.$connect();
      console.log('Database connected successfully');
    } catch (dbErr) {
      console.warn('Database connection warning (ensure PostgreSQL is running if performing DB ops):', (dbErr as Error).message);
    }

    app.listen(PORT, () => {
      console.log(`NexusStation API server running on port ${PORT}`);
      console.log(`API Docs available at http://localhost:${PORT}/api/v1/docs`);
    });
  } catch (error) {
    console.error('Fatal bootstrap error:', error);
    process.exit(1);
  }
}

bootstrap();
