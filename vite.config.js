import { string } from 'rollup-plugin-string'

/**
 * @type {import('vite').UserConfig}
 */
export default {
  plugins: [
    string({
      include: '**/*.txt',
    }),
  ],
  'optimizeDeps.include': ['valtio/vanilla'],
}
