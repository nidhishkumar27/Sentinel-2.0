/**
 * Fill the safety map with real emergency facilities from OpenStreetMap.
 *   npm run seed:facilities -- --lat 12.97 --lng 77.59 --radius 10000 [--verify]
 * Without --verify rows are imported as UNVERIFIED (review them via the API, then verify).
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { importFacilitiesFromOSM } from '../modules/safety-map/facilities.import';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const lat = Number(arg('lat'));
  const lng = Number(arg('lng'));
  const radiusM = Number(arg('radius') ?? 5000);
  const verify = process.argv.includes('--verify');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    throw new Error('Usage: npm run seed:facilities -- --lat <lat> --lng <lng> [--radius <metres, 500-20000>] [--verify]');

  await connectDB();
  const result = await importFacilitiesFromOSM({ lat, lng, radiusM: Math.min(Math.max(radiusM, 500), 20000) }, { verify });
  console.log(`Imported from OpenStreetMap${verify ? ' (marked verified)' : ' (unverified)'}:`, result);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message ?? e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
