import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Generate SHA256 checksum for a file
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex checksum
 */
async function generateChecksum(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Create a timestamped backup of all data files
 * @param {string} reason - Reason for backup (e.g., 'pre-roster-update')
 * @returns {Promise<string>} Path to backup directory
 */
export async function createDataSnapshot(reason = 'manual') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(PROJECT_ROOT, 'backups', `${timestamp}_${reason}`);

  // Create backup directory
  await fs.mkdir(backupDir, { recursive: true });

  // Files to backup
  const filesToBackup = [
    'data/rosters_2026.json',
    'data/pitchers_2026.json',
    'data/teams.json',
    'data/schedules_2026.json',
    'data/pitchers_played_index.json'
  ];

  const manifest = {
    timestamp: new Date().toISOString(),
    reason,
    files: []
  };

  // Backup each file with checksum
  for (const relPath of filesToBackup) {
    const sourcePath = path.join(PROJECT_ROOT, relPath);
    const destPath = path.join(backupDir, relPath);

    try {
      // Create subdirectories if needed
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Copy file
      await fs.copyFile(sourcePath, destPath);

      // Generate checksums
      const sourceChecksum = await generateChecksum(sourcePath);
      const backupChecksum = await generateChecksum(destPath);

      // Verify copy
      if (sourceChecksum !== backupChecksum) {
        throw new Error(`Checksum mismatch for ${relPath}`);
      }

      manifest.files.push({
        path: relPath,
        checksum: sourceChecksum,
        size: (await fs.stat(sourcePath)).size
      });

      console.log(`✓ Backed up ${relPath} (${sourceChecksum.slice(0, 8)}...)`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`⚠ Skipped ${relPath} (file not found)`);
        manifest.files.push({
          path: relPath,
          checksum: null,
          size: 0,
          missing: true
        });
      } else {
        throw error;
      }
    }
  }

  // Write manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✓ Backup created: ${backupDir}`);
  console.log(`✓ Manifest: ${manifestPath}`);

  return backupDir;
}

/**
 * Restore data from a backup directory
 * @param {string} backupDir - Path to backup directory
 * @returns {Promise<void>}
 */
export async function restoreFromBackup(backupDir) {
  // Read manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);

  console.log(`\nRestoring backup from ${manifest.timestamp}`);
  console.log(`Reason: ${manifest.reason}\n`);

  let restoredCount = 0;
  let skippedCount = 0;

  // Restore each file
  for (const fileInfo of manifest.files) {
    if (fileInfo.missing) {
      console.log(`⚠ Skipped ${fileInfo.path} (was missing in backup)`);
      skippedCount++;
      continue;
    }

    const backupFilePath = path.join(backupDir, fileInfo.path);
    const targetPath = path.join(PROJECT_ROOT, fileInfo.path);

    // Verify backup file checksum
    const backupChecksum = await generateChecksum(backupFilePath);
    if (backupChecksum !== fileInfo.checksum) {
      throw new Error(`Backup file corrupted: ${fileInfo.path}`);
    }

    // Create target directory if needed
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Restore file
    await fs.copyFile(backupFilePath, targetPath);

    // Verify restored file
    const restoredChecksum = await generateChecksum(targetPath);
    if (restoredChecksum !== fileInfo.checksum) {
      throw new Error(`Restore verification failed: ${fileInfo.path}`);
    }

    console.log(`✓ Restored ${fileInfo.path} (${restoredChecksum.slice(0, 8)}...)`);
    restoredCount++;
  }

  console.log(`\n✓ Restore complete: ${restoredCount} files restored, ${skippedCount} skipped`);
}
