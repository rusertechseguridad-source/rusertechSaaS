import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from './src/analytics/analytics.service';

const prisma = new PrismaClient();
const analyticsService = new AnalyticsService(prisma as any);

async function testApi() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return;

  const fleet = await analyticsService.getFleetAnalytics(tenant.id, { period: 'month' });
  console.log('Fleet:', fleet);

  const trips = await analyticsService.getTripsAnalytics(tenant.id, { period: 'month' });
  console.log('Trips:', trips);

  const alerts = await analyticsService.getAlertsAnalytics(tenant.id, { period: 'month' });
  console.log('Alerts:', alerts);
}

testApi().then(() => prisma.$disconnect());
