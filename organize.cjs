const fs = require('fs');
const path = require('path');

const srcDir = '/Users/cracker/OTG-original-website/public/products';
const destDir = '/Users/cracker/OTG-original-website/public/products-ready';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}const MAPPINGS = [
  { match: "OTG Above Average Long Sleeve", name: "longsleeve-camo-green-front" },
  { match: "OTG Archive", name: "archive-camo-shorts" },
  { match: "OTG Cold Heart Leather Belt", name: "cold-heart-leather-belt" },
  { match: "OTG Core Belt", name: "core-belt" },
  { match: "OTG CrossRoad", name: "crossroads-raglan" },
  { match: "OTG Crux Beanie", name: "crux-beanie" },
  { match: "OTG Divine Graffiti TankTop", name: "divine-graffiti-tanktop" },
  { match: "OTG Essential Trucker", name: "essential-trucker" },
  { match: "OTG Faith Sweat Pants", name: "faith-sweat-pants" },
  { match: "OTG Fly Gyal Polo", name: "fly-gyal-polo" },
  { match: "OTG Heart Over Logic Tee", name: "heart-over-logic-tee" },
  { match: "OTG Heaven", name: "heavens-league-polo" },
  { match: "OTG HomeGrown", name: "homegrown-26-nigeria-jersey" },
  { match: "OTG Made Different Set", name: "made-different-set" },
  { match: "OTG Members Only Jersey", name: "members-only-jersey" },
  { match: "OTG N2F2P Polo", name: "n2f2p-polo" },
  { match: "OTG Nations Polo", name: "nations-polo" },
  { match: "OTG Out This World Polo", name: "out-this-world-polo" },
  { match: "OTG Paint Our Culture Polo", name: "paint-our-culture-polo" },
  { match: "OTG Signature Socks", name: "signature-socks" },
  { match: "OTG Since", name: "since-60-long-sleeve" },
  { match: "OTG Territory Long Sleeve", name: "territory-long-sleeve" },
  { match: "OTG Too Hot Crop Tee", name: "too-hot-crop-tee" },
  { match: "OTG Unmasked Tee", name: "unmasked-tee" },
  { match: "OTG Velocity Track-Pants", name: "velocity-track-pants" },
  { match: "OTG WildSide Set", name: "wildside-set" }
];

const allFolders = fs.readdirSync(srcDir);

MAPPINGS.forEach(item => {
  const matchedFolder = allFolders.find(f => f.toLowerCase().includes(item.match.toLowerCase()));

  if (matchedFolder) {
    const folderPath = path.join(srcDir, matchedFolder);
    if (fs.statSync(folderPath).isDirectory()) {
      const files = fs.readdirSync(folderPath);
      const imgFile = files.find(f => /\.(jpg|jpeg|png)$/i.test(f));

      if (imgFile) {
        const ext = path.extname(imgFile).toLowerCase();
        const srcFile = path.join(folderPath, imgFile);
        const destFile = path.join(destDir, `${item.name}${ext}`);
        
        fs.copyFileSync(srcFile, destFile);
        console.log(`✓ ${matchedFolder} -> ${item.name}${ext}`);
      } else {
        console.log(`x NO IMAGE FOUND in ${matchedFolder}`);
      }
    }
  } else {
    console.log(`! FOLDER NOT FOUND matching: ${item.match}`);
  }
});

console.log("---");
console.log("DONE!");
