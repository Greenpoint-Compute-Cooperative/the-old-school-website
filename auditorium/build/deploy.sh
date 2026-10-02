#!/bin/zsh
# Stage a clean copy of the auditorium page and deploy it to the standalone Vercel project.
set -e
cd "$(dirname "$0")/../.."
STAGE=/tmp/theoldschool-auditorium-stage
rm -rf $STAGE && mkdir -p $STAGE/auditorium
sed -e "s#href: 'index.html#href: 'https://theoldschool.nyc/index.html#g" \
    -e "s#href: 'floorplan.html'#href: 'https://theoldschool.nyc/floorplan.html'#g" \
    auditorium.html > $STAGE/index.html
cp auditorium/scrub-engine.js $STAGE/auditorium/
cp -R auditorium/vid auditorium/still $STAGE/auditorium/
du -sh $STAGE
cd $STAGE && vercel link --yes --project theoldschool-auditorium >/dev/null && vercel deploy --prod --yes 2>&1 | tail -3
