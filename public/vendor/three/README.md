# Vendored Three.js runtime

This directory contains the minimal runtime dependency graph used by the site, copied from the official `three@0.160.0` npm package.

- Package: `three`
- Version: `0.160.0`
- npm tarball SHA-1: `cd1e4dbd01aee0719280a9086d75545db52b7a8f`
- npm integrity: `sha512-DLU8lc0zNIPkM7rH5/e1Ks1Z8tWCGRq6g8mPowdDJpw1CFBJMU7UoJjC6PefXW7z//SSl0b2+GCw14LB+uDhng==`
- License: MIT; see [`LICENSE`](LICENSE)

Only `three.module.min.js` and the loader, post-processing, shader, and utility modules reachable from `index.html` are included. Keeping these files local removes the production dependency on third-party CDN execution.

When upgrading, replace the files from one exact npm release, update this record and the import map together, then run the full browser verification checklist in the root README.
