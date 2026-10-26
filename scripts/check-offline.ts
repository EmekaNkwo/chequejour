/**
 * Static offline guarantee check. Fails if app code could reach the network or if a
 * dependency that phones home (OTA updates, analytics, crash reporting, push) is
 * installed or configured.
 *
 *   npm run check:offline
 *
 * This complements the manual airplane-mode run described in the README; it cannot
 * prove what native libraries do at runtime, only that our code and config don't ask.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'features', 'data', 'domain', 'widget'];
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Patterns that mean "this code talks to the network". */
const NETWORK_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /\bfetch\s*\(/, reason: 'fetch() call' },
  { pattern: /\bXMLHttpRequest\b/, reason: 'XMLHttpRequest' },
  { pattern: /\bnew\s+WebSocket\b/, reason: 'WebSocket' },
  { pattern: /\bEventSource\b/, reason: 'EventSource' },
  { pattern: /from\s+['"]axios['"]/, reason: 'axios import' },
  { pattern: /getExpoPushTokenAsync|getDevicePushTokenAsync/, reason: 'push token request' },
  { pattern: /\bdownloadAsync\b|File\.downloadFileAsync/, reason: 'file download' },
  // The SVG namespace is an identifier inside markup, never fetched.
  { pattern: /['"`]https?:\/\/(?!localhost|www\.w3\.org\/2000\/svg['"`])/, reason: 'remote URL literal' },
];

/** Packages that contact a server on their own. */
const FORBIDDEN_PACKAGES = [
  'expo-updates',
  'expo-insights',
  'expo-analytics',
  'sentry-expo',
  '@sentry/react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
  '@react-native-firebase/crashlytics',
  '@amplitude/analytics-react-native',
  'mixpanel-react-native',
  '@segment/analytics-react-native',
  'react-native-google-mobile-ads',
  'expo-ads-admob',
  'axios',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '__tests__') return [];
    return statSync(path).isDirectory() ? walk(path) : SOURCE_EXT.has(extname(path)) ? [path] : [];
  });
}

/** Line comments are ignored so documentation can mention URLs. */
function codeLines(text: string): { line: number; code: string }[] {
  return text.split('\n').flatMap((raw, i) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return [];
    return [{ line: i + 1, code: raw }];
  });
}

function main(): void {
  const problems: string[] = [];

  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      for (const { line, code } of codeLines(readFileSync(file, 'utf8'))) {
        for (const { pattern, reason } of NETWORK_PATTERNS) {
          if (pattern.test(code)) problems.push(`${relative(ROOT, file)}:${line} — ${reason}`);
        }
      }
    }
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const name of FORBIDDEN_PACKAGES) {
    if (deps.includes(name)) problems.push(`package.json — "${name}" contacts a server`);
  }

  const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as { expo: Record<string, unknown> };
  const updates = appJson.expo.updates as { enabled?: boolean; url?: string } | undefined;
  if (updates?.url || updates?.enabled === true) problems.push('app.json — OTA updates are configured');

  if (problems.length > 0) {
    process.stderr.write(`Offline check failed (${problems.length}):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Offline check passed: no network calls in ${SOURCE_DIRS.join(', ')}; no phone-home dependencies.\n`);
}

main();
