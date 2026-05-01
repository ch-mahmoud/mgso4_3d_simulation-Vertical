import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/plant-simulation.bundle.js',
    format: 'iife',
    sourcemap: false
  },
  plugins: [
    nodeResolve()
  ]
};
