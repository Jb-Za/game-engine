// scripts/generate-gltf-manifest.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// provide __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'scenes', 'SceneEditor', 'assets');
const OUT_DIR = path.join(__dirname, '..', 'public', 'config');
const OUT_FILE = path.join(OUT_DIR, 'gltf-assets.json');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await walk(full);
      files.push(...sub.map(s => path.relative(ASSETS_DIR, path.join(full, s))));
    } else if (/\.(gltf|glb)$/i.test(e.name)) {
      files.push(path.relative(ASSETS_DIR, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

(async () => {
  try {
    // Check if assets directory exists
    try {
      await fs.access(ASSETS_DIR);
    } catch (err) {
      console.log(`Assets directory ${ASSETS_DIR} does not exist, creating empty manifest.`);
      await fs.mkdir(OUT_DIR, { recursive: true });
      await fs.writeFile(OUT_FILE, JSON.stringify([], null, 2), 'utf8');
      console.log(`Created empty manifest at ${OUT_FILE}`);
      return;
    }

    await fs.mkdir(OUT_DIR, { recursive: true });
    const files = await walk(ASSETS_DIR);
    
    // Output array of filenames
    await fs.writeFile(OUT_FILE, JSON.stringify(files, null, 2), 'utf8');
    console.log(`Generated GLTF manifest with ${files.length} entries:`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log(`Manifest written to ${OUT_FILE}`);
  } catch (err) {
    console.error('Failed to generate GLTF manifest:', err);
    process.exit(1);
  }
})();
