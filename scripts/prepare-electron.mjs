import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "dist-electron");

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} nao encontrado em ${targetPath}. Rode "npm run build:web" antes.`);
  }
}

function recreateDir(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

ensureExists(standaloneDir, "Build standalone");
ensureExists(staticDir, "Arquivos estaticos");

recreateDir(outputDir);
copyDir(standaloneDir, outputDir);
copyDir(staticDir, path.join(outputDir, ".next", "static"));

if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(outputDir, "public"));
}

console.log(`Desktop preparado em: ${outputDir}`);
