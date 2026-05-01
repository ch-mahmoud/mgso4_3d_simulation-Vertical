# MgSO4 Plant 3D Simulation

GitHub Pages-ready static Three.js simulation for a stacked vertical MgSO4.7H2O plant concept.

## Open

Open `index.html` directly, or publish this repository with GitHub Pages.

The app uses the prebuilt browser bundle:

```text
dist/plant-simulation.bundle.js
```

No server or install step is required for GitHub Pages.

## GitHub Pages

1. Upload all files in this folder to a public GitHub repository.
2. Go to repository `Settings`.
3. Open `Pages`.
4. Set source to `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save and wait for GitHub to publish the link.

## Design Basis

- Product: MgSO4.7H2O.
- Route: MgO + 30% H2SO4.
- Operating capacity: 8 t/day.
- Annual production: 2,112 t/year at 300 days/year and 88% efficiency.
- Building concept: 20 m x 15 m footprint with a compact stacked process tower.
- Vertical process order: top MgO feed, upper reaction, mid filtration/evaporation, lower crystallization/centrifuge, grade-level drying and bagging.

## Files

- `index.html` - GitHub Pages entry point.
- `styles.css` - interface styling.
- `dist/plant-simulation.bundle.js` - bundled browser app required for Pages.
- `assets/` - visual assets.
- `src/main.js` - editable Three.js source.
- `package.json`, `package-lock.json`, `rollup.config.js` - optional build files for future editing.
- `.nojekyll` - keeps GitHub Pages from processing files with Jekyll.

## Edit And Rebuild

Only needed if you edit `src/main.js`.

```powershell
npm install
npm run build
```
