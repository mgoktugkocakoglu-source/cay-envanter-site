/**
 * CayHesabim brand asset generator.
 *
 * Generates app icons, splash screens, PWA icons, and social share images from
 * the canonical transparent logo at apps/web/assets/full_seffaf_ico.svg.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const sharp = require('sharp');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PUBLIC_ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
const PUBLIC_SOCIAL_DIR = path.join(PUBLIC_DIR, 'social');
const PUBLIC_BRAND_DIR = path.join(PUBLIC_DIR, 'brand');
const SRC_IMAGES_DIR = path.join(ROOT, 'src', 'assets', 'images');
const SRC_ICONS_DIR = path.join(ROOT, 'src', 'assets', 'icons');
const SOURCE_LOGO = path.join(ASSETS_DIR, 'full_seffaf_ico.svg');

const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#14532d';
const ICON_BG = '#f8faf8';
const SOCIAL_BG = '#f8faf8';
const SOCIAL_ACCENT = '#dcfce7';
const TEXT_DARK = '#111827';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyBrandSource() {
  fs.copyFileSync(SOURCE_LOGO, path.join(SRC_IMAGES_DIR, 'app-icon.svg'));
  fs.copyFileSync(SOURCE_LOGO, path.join(PUBLIC_BRAND_DIR, 'logo.svg'));
}

async function renderLogo(size) {
  const rendered = await sharp(SOURCE_LOGO)
    .resize(2048, 2048, { fit: 'contain' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = rendered;

  removeNearBlack(data);

  const cleaned = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  const resized = await sharp(cleaned)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();

  return cleanNearBlackPng(resized);
}

function removeNearBlack(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < 35 && g < 35 && b < 35) {
      data[i + 3] = 0;
    }
  }
}

async function cleanNearBlackPng(buffer) {
  const rendered = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeNearBlack(rendered.data);

  return sharp(rendered.data, {
    raw: {
      width: rendered.info.width,
      height: rendered.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function createSquareIcon(size, outputPath, options = {}) {
  const background = options.background ?? ICON_BG;
  const logoScale = options.logoScale ?? 0.72;
  const logoSize = Math.round(size * logoScale);
  const logo = await renderLogo(logoSize);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outputPath);
}

async function createTransparentForeground(size, outputPath) {
  const logoSize = Math.round(size * 0.72);
  const logo = await renderLogo(logoSize);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outputPath);
}

async function createSolidImage(size, outputPath, color) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toFile(outputPath);
}

async function createSplash(outputPath, background, logoScale = 0.34) {
  const size = 2732;
  const logoSize = Math.round(size * logoScale);
  const logo = await renderLogo(logoSize);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outputPath);
}

async function createSocialImage(outputPath, width, height, variant = 'wide') {
  const logoSize = variant === 'square'
    ? Math.round(Math.min(width, height) * 0.54)
    : Math.round(height * 0.56);
  const logo = await renderLogo(logoSize);
  const topAccent = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${SOCIAL_BG}"/>
    <circle cx="${Math.round(width * 0.16)}" cy="${Math.round(height * 0.18)}" r="${Math.round(height * 0.18)}" fill="${SOCIAL_ACCENT}" opacity="0.7"/>
    <circle cx="${Math.round(width * 0.88)}" cy="${Math.round(height * 0.82)}" r="${Math.round(height * 0.24)}" fill="${SOCIAL_ACCENT}" opacity="0.55"/>
    <text x="${Math.round(width / 2)}" y="${Math.round(height * 0.84)}" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-size="${Math.round(height * 0.075)}" font-weight="700" fill="${TEXT_DARK}">ÇayHesabım</text>
  </svg>`);

  await sharp(topAccent)
    .composite([{ input: logo, top: Math.round(height * 0.16), left: Math.round((width - logoSize) / 2) }])
    .png()
    .toFile(outputPath);
}

async function createWebIcons() {
  const sizes = [48, 72, 96, 128, 180, 192, 256, 512];

  for (const size of sizes) {
    const pngPath = path.join(PUBLIC_ICONS_DIR, `icon-${size}.png`);
    const webpPath = path.join(PUBLIC_ICONS_DIR, `icon-${size}.webp`);
    await createSquareIcon(size, pngPath, { logoScale: 0.72 });
    await sharp(pngPath).webp({ quality: 92 }).toFile(webpPath);

    if (size !== 180) {
      await fs.promises.copyFile(webpPath, path.join(SRC_ICONS_DIR, `icon-${size}.webp`));
    }
  }

  await fs.promises.copyFile(path.join(PUBLIC_ICONS_DIR, 'icon-48.png'), path.join(PUBLIC_DIR, 'favicon-48.png'));
  await fs.promises.copyFile(path.join(PUBLIC_ICONS_DIR, 'icon-180.png'), path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
}

function writeManifest() {
  const iconSizes = [48, 72, 96, 128, 192, 256, 512];
  const manifest = {
    name: 'Çay Hesabım',
    short_name: 'Çay Hesabım',
    description: 'Çay üreticileri için dijital hesap ve iş takip platformu.',
    lang: 'tr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: ICON_BG,
    theme_color: BRAND_GREEN,
    icons: iconSizes.flatMap((size) => [
      {
        src: `/icons/icon-${size}.png`,
        type: 'image/png',
        sizes: `${size}x${size}`,
        purpose: 'any maskable',
      },
      {
        src: `/icons/icon-${size}.webp`,
        type: 'image/webp',
        sizes: `${size}x${size}`,
        purpose: 'any maskable',
      },
    ]),
  };

  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'manifest.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  fs.copyFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), path.join(ROOT, 'src', 'manifest.webmanifest'));
}

async function run() {
  console.log('Generating CayHesabim brand assets...');

  [ASSETS_DIR, PUBLIC_DIR, PUBLIC_ICONS_DIR, PUBLIC_SOCIAL_DIR, PUBLIC_BRAND_DIR, SRC_IMAGES_DIR, SRC_ICONS_DIR].forEach(ensureDir);

  copyBrandSource();

  await createSquareIcon(1024, path.join(ASSETS_DIR, 'icon-only.png'));
  await createTransparentForeground(1024, path.join(ASSETS_DIR, 'icon-foreground.png'));
  await createSolidImage(1024, path.join(ASSETS_DIR, 'icon-background.png'), ICON_BG);

  await createSplash(path.join(ASSETS_DIR, 'splash.png'), ICON_BG, 0.34);
  await createSplash(path.join(ASSETS_DIR, 'splash-dark.png'), BRAND_GREEN_DARK, 0.34);

  await createWebIcons();

  await createSocialImage(path.join(PUBLIC_SOCIAL_DIR, 'og-image.png'), 1200, 630);
  await createSocialImage(path.join(PUBLIC_SOCIAL_DIR, 'twitter-image.png'), 1200, 675);
  await createSocialImage(path.join(PUBLIC_SOCIAL_DIR, 'whatsapp-image.png'), 1200, 630);
  await createSocialImage(path.join(PUBLIC_SOCIAL_DIR, 'instagram-share.png'), 1200, 1200, 'square');

  execSync(
    'npx @capacitor/assets generate ' +
      `--iconBackgroundColor "${ICON_BG}" ` +
      `--iconBackgroundColorDark "${BRAND_GREEN_DARK}" ` +
      `--splashBackgroundColor "${ICON_BG}" ` +
      `--splashBackgroundColorDark "${BRAND_GREEN_DARK}"`,
    { stdio: 'inherit', cwd: ROOT }
  );

  writeManifest();

  console.log('Brand assets generated.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
