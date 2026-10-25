/**
 * @jest-environment node
 */
import appJson from '../../app.json';
import { BACKUP_APP_ID } from '../../data/backup';
import { DATABASE_NAME } from '../app/bootstrap';

describe('app identity', () => {
  it('is called Chaque Jour', () => {
    expect(appJson.expo.name).toBe('Chaque Jour');
  });

  it('keeps the identifiers existing installs and backups depend on', () => {
    expect(appJson.expo.android.package).toBe('com.emeka.chequejour');
    expect(appJson.expo.ios.bundleIdentifier).toBe('com.emeka.chequejour');
    expect(appJson.expo.scheme).toBe('chequejour');
    expect(DATABASE_NAME).toBe('chequejour.db');
    expect(BACKUP_APP_ID).toBe('chequejour');
  });
});
