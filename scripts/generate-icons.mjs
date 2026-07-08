import sharp from "sharp";
import { writeFileSync } from "fs";

// Fydor app icon: purple gradient with "H" letter

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="360" font-family="Georgia, serif" font-size="320" font-weight="bold" fill="white" text-anchor="middle">H</text>
</svg>`;

writeFileSync("public/icon.svg", svgIcon);

const svgBuffer = Buffer.from(svgIcon);

// Apple touch icon (180x180)
await sharp(svgBuffer).resize(180, 180).png().toFile("public/apple-touch-icon.png");
console.log("Generated apple-touch-icon.png");

// favicon (32x32)
await sharp(svgBuffer).resize(32, 32).png().toFile("public/favicon-32x32.png");
await sharp(svgBuffer).resize(16, 16).png().toFile("public/favicon-16x16.png");
console.log("Generated favicons");
