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

async function createSplash(outputPath) {
  const width = 2732;
  const height = 2732;
  const logoSize = 520;
  const logo = await renderLogo(logoSize);
  const scene = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbfcf7"/>
      <stop offset="0.52" stop-color="#f7faf3"/>
      <stop offset="1" stop-color="#e7f4df"/>
    </linearGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#cde8bf"/>
      <stop offset="1" stop-color="#79bf50"/>
    </linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8f4df"/>
      <stop offset="1" stop-color="#9dd06f"/>
    </linearGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c9f26c"/>
      <stop offset="0.48" stop-color="#75bd34"/>
      <stop offset="1" stop-color="#0d5a31"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  <circle cx="430" cy="410" r="240" fill="#eef8e8" opacity="0.55" filter="url(#soft)"/>
  <circle cx="2280" cy="1800" r="310" fill="#eaf7e7" opacity="0.72" filter="url(#soft)"/>

  <text x="1366" y="1325" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-size="156" font-weight="800">
    <tspan fill="#66b82f">Çay</tspan><tspan fill="#064f35"> Hesabım</tspan>
  </text>
  <text x="1366" y="1466" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-size="76" font-weight="500" fill="#454955">Çiftçiden veriye,</text>
  <text x="1366" y="1566" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-size="76" font-weight="500" fill="#454955">gelecek nesillere.</text>

  <path d="M0 2055 C430 1900 720 2070 1060 1940 C1450 1792 1750 1998 2100 1850 C2350 1746 2540 1755 2732 1715 L2732 2732 L0 2732 Z" fill="#edf6e5"/>
  <path d="M0 2150 C310 2020 630 2075 900 1985 C1220 1875 1530 2060 1850 1948 C2200 1825 2475 1840 2732 1768 L2732 2732 L0 2732 Z" fill="url(#hillB)" opacity="0.78"/>
  <path d="M0 2268 C260 2156 560 2188 820 2095 C1160 1975 1432 2220 1815 2075 C2140 1955 2390 1990 2732 1900 L2732 2732 L0 2732 Z" fill="url(#hillA)" opacity="0.85"/>
  <path d="M0 2352 C430 2256 790 2374 1180 2238 C1570 2100 1940 2262 2260 2160 C2460 2095 2615 2075 2732 2050 L2732 2732 L0 2732 Z" fill="#67b546" opacity="0.88"/>

  ${teaRows(0, 2050, width)}
  ${foregroundLeaves(width, height)}
</svg>`);

  await sharp(scene)
    .composite([{ input: logo, top: 680, left: Math.round((width - logoSize) / 2) }])
    .png()
    .toFile(outputPath);
}

function teaRows(x, y, width) {
  const rows = [];
  for (let i = 0; i < 13; i += 1) {
    const yy = y + i * 50;
    const opacity = Math.max(0.18, 0.56 - i * 0.025);
    rows.push(`<path d="M${x - 80} ${yy} C${width * 0.22} ${yy - 110} ${width * 0.42} ${yy + 80} ${width + 80} ${yy - 80}" fill="none" stroke="#2d8a3e" stroke-width="${18 + i}" stroke-linecap="round" opacity="${opacity}"/>`);
  }
  return rows.join('');
}

function foregroundLeaves(width, height) {
  const leaves = [];
  const positions = [
    [120, 2540, -28, 1.25], [265, 2605, -12, 1.05], [430, 2510, 20, 1.2],
    [2040, 2555, -24, 1.25], [2245, 2468, 10, 1.35], [2470, 2525, 28, 1.28],
    [800, 2650, -18, 0.9], [1540, 2645, 18, 0.9]
  ];

  for (const [cx, cy, rotate, scale] of positions) {
    leaves.push(`<g transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${scale})">
      <path d="M0 0 C-68 -210 18 -360 124 -500 C190 -308 166 -118 0 0 Z" fill="url(#leaf)"/>
      <path d="M8 -28 C48 -168 82 -302 116 -452" fill="none" stroke="#e8ffd1" stroke-width="8" opacity="0.62"/>
      <path d="M4 -110 C-42 -154 -76 -196 -104 -250" fill="none" stroke="#e8ffd1" stroke-width="6" opacity="0.45"/>
    </g>`);
  }

  leaves.push(`<rect x="0" y="${height - 190}" width="${width}" height="190" fill="#064f35" opacity="0.18"/>`);
  return leaves.join('');
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

  await createSplash(path.join(ASSETS_DIR, 'splash.png'));
  await createSplash(path.join(ASSETS_DIR, 'splash-dark.png'));

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
