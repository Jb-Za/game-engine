import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sceneFile = path.resolve(repoRoot, 'src', 'scenes', 'SceneEditor', 'testscene.json');
const publicRoot = path.resolve(repoRoot, 'public');
const destFolder = path.resolve(publicRoot, 'assets', 'DungeonAssets');

if (!fs.existsSync(destFolder)) {
  fs.mkdirSync(destFolder, { recursive: true });
}

let raw = fs.readFileSync(sceneFile, 'utf8');
// Preserve leading // comment lines so they aren't lost when writing the JSON back
const lines = raw.split(/\r?\n/);
let leadingComments = [];
let i = 0;
for (; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t.startsWith('//')) {
    leadingComments.push(lines[i]);
  } else if (t === '') {
    // keep blank lines at top as part of comments block
    leadingComments.push(lines[i]);
  } else {
    break;
  }
}
const commentPrefix = leadingComments.length ? leadingComments.join('\n') + '\n' : '';
// Remove leading comment lines before parsing
const contentToParse = lines.slice(i).join('\n');

let sceneData;
try {
  sceneData = JSON.parse(contentToParse);
} catch (err) {
  console.error('Failed to parse scene JSON (after stripping leading comments):', err.message);
  process.exit(1);
}

function makeUnique(destDir, name) {
  const parsed = path.parse(name);
  const base = parsed.name;
  const ext = parsed.ext;
  let candidate = `${base}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(destDir, candidate))) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }
  return candidate;
}

const objs = sceneData.sceneObjects || [];
// Map to reuse the same copied filename when multiple objects reference the same source
const copiedMap = new Map();
for (const obj of objs) {
  const fp = obj.filePath;
  if (typeof fp !== 'string') continue;
  if (!fp.toLowerCase().endsWith('.glb')) continue;

  const normalized = fp.replace(/^\/+/, '');

  let srcPath = path.resolve(publicRoot, normalized);

  // Fallback: relative to scene file directory
  if (!fs.existsSync(srcPath)) {
    const fallback = path.resolve(path.dirname(sceneFile), normalized);
    if (fs.existsSync(fallback)) srcPath = fallback;
  }

  if (!fs.existsSync(srcPath)) {
    console.warn('Source file not found for', fp, '\nChecked:', srcPath);
    continue;
  }

  // If we've already copied this exact source file, reuse the same destination name
  if (copiedMap.has(srcPath)) {
    const existingName = copiedMap.get(srcPath);
    obj.filePath = path.posix.join('assets', 'DungeonAssets', existingName);
    console.log(`Reused copy for: ${srcPath} -> ${existingName}`);
    continue;
  }

  const filename = path.basename(srcPath);
  const destCandidate = path.join(destFolder, filename);

  // If a file with the same name already exists in the destination, reuse it (don't copy again)
  if (fs.existsSync(destCandidate)) {
    // Record mapping so other objects using the same source reuse this existing file
    copiedMap.set(srcPath, filename);
    obj.filePath = path.posix.join('assets', 'DungeonAssets', filename);
    console.log(`Destination exists, reusing without copying: ${destCandidate}`);
    continue;
  }

  const uniqueName = makeUnique(destFolder, filename);
  const destPath = path.join(destFolder, uniqueName);

  try {
    // Copy the file (do not remove the original)
    fs.copyFileSync(srcPath, destPath);

    // Record mapping so other objects using the same source reuse this copy
    copiedMap.set(srcPath, uniqueName);

    // Update JSON path to the new public assets path using forward slashes
    obj.filePath = path.posix.join('assets', 'DungeonAssets', uniqueName);
    console.log(`Copied: ${srcPath} -> ${destPath}`);
  } catch (err) {
    console.error('Failed to copy', srcPath, '->', destPath, err.message);
  }
}

try {
  const out = commentPrefix + JSON.stringify(sceneData, null, 2);
  fs.writeFileSync(sceneFile, out, 'utf8');
  console.log('Updated scene file:', sceneFile);
  console.log('Done.');
} catch (err) {
  console.error('Failed to write scene file:', err.message);
  process.exit(1);
}