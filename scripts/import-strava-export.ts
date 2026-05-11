/**
 * Script to import Strava GPX export files
 *
 * Usage:
 *   npx tsx scripts/import-strava-export.ts <path-to-activities-folder>
 *
 * Example:
 *   npx tsx scripts/import-strava-export.ts D:\Projets\run_tracker\activities
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseGpx } from '../src/lib/gpx/parser';

const TEMP_USER_ID = 'demo-user';

interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  activities: Array<{
    filename: string;
    name: string;
    date: string;
    distance: number;
    success: boolean;
    error?: string;
  }>;
}

async function importStravaExport(activitiesPath: string): Promise<ImportResult> {
  const result: ImportResult = {
    total: 0,
    successful: 0,
    failed: 0,
    activities: [],
  };

  // Check if directory exists
  if (!fs.existsSync(activitiesPath)) {
    console.error(`Directory not found: ${activitiesPath}`);
    process.exit(1);
  }

  // Get all GPX files
  const files = fs.readdirSync(activitiesPath).filter((f) =>
    f.toLowerCase().endsWith('.gpx')
  );

  console.log(`Found ${files.length} GPX files in ${activitiesPath}`);
  result.total = files.length;

  for (const filename of files) {
    const filepath = path.join(activitiesPath, filename);

    try {
      console.log(`Processing: ${filename}`);

      const content = fs.readFileSync(filepath, 'utf-8');
      const parseResult = parseGpx(content, filename, {
        userId: TEMP_USER_ID,
        onlyRunning: true,
      });

      if (parseResult.success && parseResult.activity) {
        result.successful++;
        result.activities.push({
          filename,
          name: parseResult.activity.name,
          date: new Date(parseResult.activity.startTime).toISOString(),
          distance: parseResult.activity.stats.distanceMeters,
          success: true,
        });

        console.log(
          `  ✓ ${parseResult.activity.name} - ${(parseResult.activity.stats.distanceMeters / 1000).toFixed(2)}km`
        );
      } else {
        result.failed++;
        result.activities.push({
          filename,
          name: filename,
          date: '',
          distance: 0,
          success: false,
          error: parseResult.error,
        });

        console.log(`  ✗ Skipped: ${parseResult.error}`);
      }
    } catch (error) {
      result.failed++;
      result.activities.push({
        filename,
        name: filename,
        date: '',
        distance: 0,
        success: false,
        error: (error as Error).message,
      });

      console.log(`  ✗ Error: ${(error as Error).message}`);
    }
  }

  return result;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/import-strava-export.ts <path-to-activities-folder>');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx scripts/import-strava-export.ts D:\\Projets\\run_tracker\\activities');
    process.exit(1);
  }

  const activitiesPath = args[0];

  console.log('');
  console.log('Strava GPX Import Script');
  console.log('========================');
  console.log('');

  const result = await importStravaExport(activitiesPath);

  console.log('');
  console.log('Summary');
  console.log('-------');
  console.log(`Total files:  ${result.total}`);
  console.log(`Successful:   ${result.successful}`);
  console.log(`Failed:       ${result.failed}`);

  // Calculate total distance
  const totalDistance = result.activities
    .filter((a) => a.success)
    .reduce((sum, a) => sum + a.distance, 0);

  console.log(`Total distance: ${(totalDistance / 1000).toFixed(2)}km`);

  // Write results to JSON file
  const outputPath = path.join(process.cwd(), 'import-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  console.log('\nNote: This script only validates and parses the files.');
  console.log('To actually import them into IndexedDB, use the import page in the app.');
}

main().catch(console.error);
