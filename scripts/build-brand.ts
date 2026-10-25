/**
 * Generates the app icon, Android adaptive/monochrome layers, notification icon,
 * splash image, favicon and logo lockups from components/brand/logo-geometry.ts.
 *
 *   npm run brand:build
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUBBLE_PATH,
  CHECK_PATH,
  CHECK_WIDTH,
  GLYPH_OFFSET,
  LOGO_CANVAS,
  LOGO_COLORS,
  SUN,
  SUN_GAP,
  TILE_RADIUS,
} from '../components/brand/logo-geometry';

const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'assets');
const BRAND = join(ASSETS, 'brand');
const FONT = join(ROOT, 'node_modules/@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf');

/** Android adaptive icons crop to a 66% safe zone, so the glyph is drawn smaller there. */
const ADAPTIVE_SCALE = 0.84;
const NOTIFICATION_SCALE = 1.2;

const C = LOGO_CANVAS;
const half = C / 2;

function placed(scale: number, body: string): string {
  return `<g transform="translate(${half} ${half}) scale(${scale}) translate(${-half + GLYPH_OFFSET.x} ${-half + GLYPH_OFFSET.y})">${body}</g>`;
}

/** Full-colour glyph; `gap` is the colour that separates the sun from the bubble. */
function colourGlyph(scale: number, gap: string): string {
  return placed(
    scale,
    `<path d="${BUBBLE_PATH}" fill="${LOGO_COLORS.bubble}"/>
     <path d="${CHECK_PATH}" fill="none" stroke="${LOGO_COLORS.check}" stroke-width="${CHECK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
     <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r + SUN_GAP}" fill="${gap}"/>
     <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="${LOGO_COLORS.sun}"/>`,
  );
}

/** Single-colour silhouette for Android themed icons and the notification icon: only alpha counts. */
function silhouette(scale: number, colour: string): string {
  return `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${C}" height="${C}">
      ${placed(
        scale,
        `<path d="${BUBBLE_PATH}" fill="white"/>
         <path d="${CHECK_PATH}" fill="none" stroke="black" stroke-width="${CHECK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
         <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r + SUN_GAP}" fill="black"/>
         <circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="white"/>`,
      )}
    </mask></defs>
    <rect width="${C}" height="${C}" fill="${colour}" mask="url(#m)"/>`;
}

const svg = (body: string, width = C, height = C) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

const tile = (radius: number) => `<rect width="${C}" height="${C}" rx="${radius}" fill="${LOGO_COLORS.coral}"/>${colourGlyph(1, LOGO_COLORS.coral)}`;

function lockup(textColour: string): string {
  const height = 360;
  const icon = `<g transform="translate(20 20) scale(${(height - 40) / C})">${tile(TILE_RADIUS)}</g>`;
  const text = `<text x="${height + 24}" y="${height / 2 + 6}" font-family="Nunito" font-weight="900" font-size="112" fill="${textColour}" dominant-baseline="middle">Chèque du jour</text>`;
  return svg(`${icon}${text}`, 1400, height);
}

function write(name: string, source: string, size: number, dir = ASSETS): void {
  const png = new Resvg(source, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Nunito' },
  })
    .render()
    .asPng();
  writeFileSync(join(dir, name), png);
  process.stdout.write(`wrote ${join(dir, name).replace(`${ROOT}/`, '')}\n`);
}

mkdirSync(BRAND, { recursive: true });

// iOS and legacy Android: full-bleed square, the OS rounds the corners.
write('icon.png', svg(tile(0)), 1024);
write('android-icon-background.png', svg(`<rect width="${C}" height="${C}" fill="${LOGO_COLORS.coral}"/>`), 1024);
write('android-icon-foreground.png', svg(colourGlyph(ADAPTIVE_SCALE, LOGO_COLORS.coral)), 1024);
write('android-icon-monochrome.png', svg(silhouette(ADAPTIVE_SCALE, '#FFFFFF')), 1024);
write('notification-icon.png', svg(silhouette(NOTIFICATION_SCALE, '#FFFFFF')), 96);
write('splash-icon.png', svg(tile(TILE_RADIUS)), 1024);
write('favicon.png', svg(tile(TILE_RADIUS)), 48);

const markSvg = svg(tile(TILE_RADIUS));
writeFileSync(join(BRAND, 'mark.svg'), markSvg);
write('logo-light.png', lockup(LOGO_COLORS.check), 1400, BRAND);
write('logo-dark.png', lockup('#FFFFFF'), 1400, BRAND);
