#!/bin/zsh
# usage: seams.sh  — for each raw/legN.mp4, dump first+last frame, and SSIM last(N) vs first(N+1) / anchor photo
cd "$(dirname "$0")"
mkdir -p frames
for f in raw/leg*.mp4; do
  n=${${f:t}%.mp4}
  ffmpeg -y -loglevel error -i $f -vframes 1 frames/$n-first.jpg
  ffmpeg -y -loglevel error -sseof -0.05 -i $f -update 1 -vframes 1 frames/$n-last.jpg
  echo "$n: $(ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate,nb_frames -of csv=p=0 $f)"
done
ssim(){ ffmpeg -loglevel info -i $1 -i $2 -filter_complex "[0:v]scale=640:360[a];[1:v]scale=640:360[b];[a][b]ssim" -f null - 2>&1 | grep -o 'All:[0-9.]*' }
echo "--- seams (SSIM, 1.0 = identical) ---"
for pair in "leg0 A2 leg1" "leg1 A3 leg2" "leg2 A4 leg3" "leg3 A5 leg4" "leg4 A6 leg5" "leg5 A2 leg1"; do
  set -- ${=pair}
  [[ -f frames/$1-last.jpg && -f frames/$3-first.jpg ]] || continue
  echo "$1.last vs $2 photo: $(ssim frames/$1-last.jpg src/$2.jpg)   |  $1.last vs $3.first: $(ssim frames/$1-last.jpg frames/$3-first.jpg)"
done
