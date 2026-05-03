/**
 * Çay Hesabım - App Store / Play Store İkon ve Splash Screen Üretici
 *
 * Kullanım:
 *   node scripts/generate-assets.mjs
 *
 * Bu script:
 *  1. SVG ikondan 1024x1024 PNG üretir (icon-only.png, icon-foreground.png)
 *  2. Arkaplan rengiyle icon-background.png üretir
 *  3. 2732x2732 splash.png ve splash-dark.png üretir
 *  4. @capacitor/assets ile tüm platform ikonlarını üretir
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
const SVG_PATH = path.join(ROOT, 'src/assets/images/app-icon.svg');

const BRAND_GREEN = '#16a34a';
const BRAND_GREEN_DARK = '#15803d';
const WHITE = '#ffffff';

// Splash screen arka planı SVG (2732x2732, logo ortada)
function createSplashSvg(bgColor, textColor = '#ffffff') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">
  <rect width="2732" height="2732" fill="${bgColor}"/>
  <!-- Merkezi ikon (512x512 boyutunda, ortada) -->
  <g transform="translate(1110, 1110)">
    <!-- Fincan gövdesi -->
    <rect x="62" y="130" width="400" height="260" rx="30" ry="30" fill="${textColor}" opacity="0.95"/>
    <!-- Kulp -->
    <path d="M462 180 Q550 180 550 260 Q550 340 462 340" fill="none" stroke="${textColor}" stroke-width="40" stroke-linecap="round" opacity="0.95"/>
    <!-- Altlık -->
    <rect x="12" y="390" width="500" height="30" rx="15" fill="${textColor}" opacity="0.85"/>
    <rect x="62" y="420" width="400" height="20" rx="10" fill="${textColor}" opacity="0.70"/>
    <!-- Buhar -->
    <path d="M170 90 Q190 50 170 10" fill="none" stroke="${textColor}" stroke-width="20" stroke-linecap="round" opacity="0.75"/>
    <path d="M262 90 Q282 50 262 10" fill="none" stroke="${textColor}" stroke-width="20" stroke-linecap="round" opacity="0.75"/>
    <path d="M354 90 Q374 50 354 10" fill="none" stroke="${textColor}" stroke-width="20" stroke-linecap="round" opacity="0.75"/>
    <!-- ₺ -->
    <text x="262" y="295" font-family="Arial" font-size="140" font-weight="bold" fill="${bgColor}" text-anchor="middle" dominant-baseline="middle">₺</text>
  </g>
  <!-- Alt yazı -->
  <text x="1366" y="1760" font-family="Arial, sans-serif" font-size="80" font-weight="600" fill="${textColor}" text-anchor="middle" opacity="0.9">Çay Hesabım</text>
</svg>`;
}

async function run() {
  console.log('📱 Çay Hesabım - App Store varlıkları üretiliyor...\n');

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  // 1. icon-only.png (1024x1024) - şeffaf arka plan yok, tam ikon
  console.log('🎨 icon-only.png üretiliyor (1024x1024)...');
  const svgBuffer = fs.readFileSync(SVG_PATH);
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-only.png'));
  console.log('   ✓ icon-only.png');

  // 2. icon-foreground.png - Android adaptive icon ön planı (1024x1024, ikon şekli)
  console.log('🎨 icon-foreground.png üretiliyor...');
  // Merkezi 70% boyutunda, şeffaf arka plan üzerinde
  const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <rect width="1024" height="1024" fill="none"/>
    <g transform="translate(112, 112) scale(0.78)">
      <rect x="312" y="460" width="400" height="260" rx="30" fill="white"/>
      <path d="M712 510 Q800 510 800 590 Q800 670 712 670" fill="none" stroke="white" stroke-width="40" stroke-linecap="round"/>
      <rect x="262" y="720" width="500" height="30" rx="15" fill="white" opacity="0.85"/>
      <rect x="312" y="750" width="400" height="20" rx="10" fill="white" opacity="0.70"/>
      <path d="M420 400 Q440 360 420 320 Q400 280 420 240" fill="none" stroke="white" stroke-width="22" stroke-linecap="round" opacity="0.75"/>
      <path d="M512 400 Q532 360 512 320 Q492 280 512 240" fill="none" stroke="white" stroke-width="22" stroke-linecap="round" opacity="0.75"/>
      <path d="M604 400 Q624 360 604 320 Q584 280 604 240" fill="none" stroke="white" stroke-width="22" stroke-linecap="round" opacity="0.75"/>
      <text x="512" y="640" font-family="Arial" font-size="140" font-weight="bold" fill="${BRAND_GREEN}" text-anchor="middle" dominant-baseline="middle">₺</text>
    </g>
  </svg>`;
  await sharp(Buffer.from(fgSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-foreground.png'));
  console.log('   ✓ icon-foreground.png');

  // 3. icon-background.png - Android adaptive icon arka planı (düz renk)
  console.log('🎨 icon-background.png üretiliyor...');
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 22, g: 163, b: 74, alpha: 1 }, // #16a34a
    },
  })
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-background.png'));
  console.log('   ✓ icon-background.png');

  // 4. splash.png ve splash-dark.png kontrolü
  console.log('🔍 Splash görselleri kontrol ediliyor...');
  const splashPath = path.join(ASSETS_DIR, 'splash.png');
  const splashDarkPath = path.join(ASSETS_DIR, 'splash-dark.png');

  if (!fs.existsSync(splashPath)) {
    console.log('🎨 splash.png üretiliyor (varsayılan)...');
    const splashSvg = createSplashSvg(BRAND_GREEN, WHITE);
    await sharp(Buffer.from(splashSvg)).resize(2732, 2732).png().toFile(splashPath);
  } else {
    console.log('   ✓ Mevcut splash.png kullanılıyor.');
  }

  if (!fs.existsSync(splashDarkPath)) {
    console.log('🎨 splash-dark.png üretiliyor (varsayılan)...');
    const splashDarkSvg = createSplashSvg(BRAND_GREEN_DARK, WHITE);
    await sharp(Buffer.from(splashDarkSvg)).resize(2732, 2732).png().toFile(splashDarkPath);
  } else {
    console.log('   ✓ Mevcut splash-dark.png kullanılıyor.');
  }

  console.log('\n✅ Kaynak varlıklar hazır! Şimdi platform ikonları üretiliyor...\n');

  // 6. @capacitor/assets ile tüm platform ikonlarını üret
  try {
    execSync(
      'npx @capacitor/assets generate ' +
        '--iconBackgroundColor "#16a34a" ' +
        '--iconBackgroundColorDark "#15803d" ' +
        '--splashBackgroundColor "#16a34a" ' +
        '--splashBackgroundColorDark "#15803d"',
      { stdio: 'inherit', cwd: ROOT }
    );
    console.log('\n🎉 Tüm platform ikonları başarıyla üretildi!');
  } catch (err) {
    console.error('\n❌ @capacitor/assets hatası:', err.message);
    process.exit(1);
  }

  console.log('\n📋 Sonraki adımlar:');
  console.log('   iOS  : pnpm cap:ios   (Xcode açılır, App Store\'a gönder)');
  console.log('   Android: pnpm cap:android (Android Studio açılır, Play Store\'a gönder)');
}

run().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
