import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const svgPath = path.resolve("blip-mascot.svg");
  try {
    const svgBuffer = await fs.readFile(svgPath);
    
    await fs.mkdir("dist", { recursive: true });
    
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.resolve("dist/favicon-32x32.png"));
    
    await sharp(svgBuffer)
      .resize(64, 64)
      .png()
      .toFile(path.resolve("dist/favicon-64x64.png"));

    console.log("✓ Rasterized mascot favicons to dist/favicon-32x32.png and dist/favicon-64x64.png");
  } catch (err: any) {
    console.error("Failed to rasterize mascot:", err.message);
    process.exit(1);
  }
}

main();
