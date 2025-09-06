import { NodeIO } from '@gltf-transform/core';
import path from 'path';
import fs from 'fs';

async function mergeAllGltfInDir(dirPath, { dryRun = false, verbose = false } = {}) {
    const io = new NodeIO();
    const resolvedDir = path.resolve(dirPath);

    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        console.error(`Invalid directory: ${resolvedDir}`);
        process.exit(1);
    }

    const gltfFiles = fs.readdirSync(resolvedDir).filter(f => f.toLowerCase().endsWith('.gltf'));

    if (gltfFiles.length === 0) {
        console.error(`No .gltf files found in: ${resolvedDir}`);
        return;
    }

    for (const file of gltfFiles) {
        const inputPath = path.join(resolvedDir, file);
        const outputPath = path.join(resolvedDir, path.basename(file, '.gltf') + '.glb');

        try {
            if (verbose) console.log(`Reading: ${inputPath}`);
            const document = await io.read(inputPath);

            const root = document.getRoot();
            const buffers = root.listBuffers();
            const accessors = root.listAccessors();

            // Merge multiple buffers into one
            if (buffers.length > 1) {
                if (verbose) console.log(`  Consolidating ${buffers.length} buffers`);
                const primaryBuffer = buffers[0];
                accessors.forEach((a) => a.setBuffer(primaryBuffer));
                buffers.forEach((b, i) => { if (i > 0) b.dispose(); });
            }

            if (dryRun) {
                console.log(`[dry-run] Would write: ${outputPath}`);
                continue;
            }

            if (verbose) console.log(`Writing: ${outputPath}`);
            await io.write(outputPath, document);

            // ✅ Delete original .gltf and .bin files
            fs.unlinkSync(inputPath);
            const binPath = path.join(resolvedDir, path.basename(file, '.gltf') + '.bin');
            if (fs.existsSync(binPath)) {
                fs.unlinkSync(binPath);
                if (verbose) console.log(`  Deleted: ${binPath}`);
            }

            console.log(`Converted & cleaned: ${file} → ${path.basename(outputPath)}`);
        } catch (err) {
            console.error(`Error converting ${file}: ${err.message}`);
        }
    }
}

// --- CLI handling ---
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log('Usage: node mergeGLTF.js <folderPath> [--dry] [--verbose]');
    process.exit(0);
}

const flags = { dryRun: false, verbose: false };
const dirPath = argv[0];

for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--dry') flags.dryRun = true;
    if (argv[i] === '--verbose') flags.verbose = true;
}

mergeAllGltfInDir(dirPath, flags);
