#!/bin/zsh

SRC="/Users/cracker/OTG-original-website/public/products"
DEST="/Users/cracker/OTG-original-website/public/products-ready"

mkdir -p "$DEST"

copy_img() {
  local folder="$1"
  local newname="$2"
  
  # Find matching directory even with wildcards
  local filepath=$(ls -d $SRC/$folder 2>/dev/null | head -1)

  if [ -n "$filepath" ] && [ -d "$filepath" ]; then
    local img=$(ls "$filepath" 2>/dev/null | grep -iE '\.(jpg|jpeg|png)$' | head -1)
    if [ -n "$img" ]; then
      local ext="${img##*.}"
      ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
      cp "$filepath/$img" "$DEST/$newname.$ext"
      echo "✓ $(basename "$filepath") -> $newname.$ext"
    else
      echo "x NO IMAGE FOUND in $(basename "$filepath")"
    fi
  else
    echo "! FOLDER NOT FOUND: $folder"
  fi
}copy_img "OTG Above Average Long Sleeve" "longsleeve-camo-green-front"
copy_img "OTG Archive*" "archive-camo-shorts"
copy_img "OTG Cold Heart Leather Belt" "cold-heart-leather-belt"
copy_img "OTG Core Belt" "core-belt"
copy_img "OTG CrossRoad*" "crossroads-raglan"
copy_img "OTG Crux Beanie" "crux-beanie"
copy_img "OTG Divine Graffiti TankTop" "divine-graffiti-tanktop"
copy_img "OTG Essential Trucker" "essential-trucker"
copy_img "OTG Faith Sweat Pants" "faith-sweat-pants"
copy_img "OTG Fly Gyal Polo" "fly-gyal-polo"
copy_img "OTG Heart Over Logic Tee" "heart-over-logic-tee"
copy_img "OTG Heaven*" "heavens-league-polo"
copy_img "OTG HomeGrown*" "homegrown-26-nigeria-jersey"
copy_img "OTG Made Different Set" "made-different-set"
copy_img "OTG Members Only Jersey" "members-only-jersey"
copy_img "OTG N2F2P Polo" "n2f2p-polo"
copy_img "OTG Nations Polo" "nations-polo"
copy_img "OTG Out This World Polo" "out-this-world-polo"
copy_img "OTG Paint Our Culture Polo" "paint-our-culture-polo"
copy_img "OTG Signature Socks" "signature-socks"
copy_img "OTG Since*" "since-60-long-sleeve"
copy_img "OTG Territory Long Sleeve" "territory-long-sleeve"
copy_img "OTG Too Hot Crop Tee" "too-hot-crop-tee"
copy_img "OTG Unmasked Tee" "unmasked-tee"
copy_img "OTG Velocity Track-Pants" "velocity-track-pants"
copy_img "OTG WildSide Set" "wildside-set"

echo "---"
echo "DONE!"
