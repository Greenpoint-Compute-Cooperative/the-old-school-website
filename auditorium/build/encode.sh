#!/bin/zsh
# usage: encode.sh N [N...]  — encodes up/legN.mp4 (1080p upscale) into ../vid + ../still (desktop + 4:3 mobile)
cd "$(dirname "$0")"
for n in "$@"; do
  in=up/leg$n.mp4; [[ -f $in ]] || { echo "missing $in"; continue; }
  # optional per-leg trim (seconds) via TRIM_<n> env, and optional reverse via REV_<n>=1
  t=; eval "tv=\${TRIM_$n}"; [[ -n $tv ]] && t="-t $tv"
  rv=; eval "rvv=\${REV_$n}"; [[ -n $rvv ]] && rv="reverse,"
  # optional baked black & white via GRAY=1 (CSS filter on <video> made scrubbing choppy)
  gr=; [[ -n $GRAY ]] && gr="hue=s=0,eq=contrast=1.04,"
  ffmpeg -y -loglevel error ${=t} -i $in -an -vf "${rv}scale=1920:1080:flags=lanczos,unsharp=5:5:0.4:5:5:0.0,${gr}format=yuv420p" \
    -c:v libx264 -preset slow -crf 20 -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart ../vid/leg$n.mp4
  ffmpeg -y -loglevel error ${=t} -i $in -an -vf "${rv}crop=ih*4/3:ih,scale=960:720:flags=lanczos,unsharp=5:5:0.3:5:5:0.0,${gr}format=yuv420p" \
    -c:v libx264 -preset slow -crf 23 -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart ../vid/leg$n-m.mp4
  ffmpeg -y -loglevel error -i ../vid/leg$n.mp4 -vframes 1 -q:v 3 ../still/leg$n.jpg
  ffmpeg -y -loglevel error -i ../vid/leg$n-m.mp4 -vframes 1 -q:v 4 ../still/leg$n-m.jpg
  echo "leg$n: $(ffprobe -v error -show_entries format=duration -of csv=p=0 ../vid/leg$n.mp4)s $(du -h ../vid/leg$n.mp4 | cut -f1) / mobile $(du -h ../vid/leg$n-m.mp4 | cut -f1)"
done
