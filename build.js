const esbuild = require('esbuild');
const fs = require('fs');
const { sassPlugin } = require('esbuild-sass-plugin');

const isProd = process.env.NODE_ENV === 'production';

const gameTitle = "IF-Octane Build Test";

const browserTargets = [
    'chrome90',
    'firefox88',
    'safari14',
    'edge90'
];

const buildConfig = {
    entryPoints: ['src/index.ts'], // Allow injecting game files
    bundle: true,
    minify: isProd,
    sourcemap: !isProd,
    target: browserTargets,
    format: 'iife',
    outfile: 'dist/bundle.js',
    define: {
        'process.env.NODE_ENV': `"${isProd ? 'production' : 'development'}"`
    },
    loader: {
        '.css': 'local-css',
        '.scss': 'local-css',
        '.sass': 'local-css',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl'
    },
    plugins: [sassPlugin()],
    logLevel: 'info',
    charset: 'utf8'
};

async function buildHTML() {
    console.log("Build HTML dist...");
    
    const bundledJS = fs.readFileSync('dist/bundle.js', 'utf8');
    const bundledCSS = fs.readFileSync('dist/bundle.css', 'utf8');
    const template = fs.readFileSync('public/index.html', 'utf8');
    
    const html = template
          .replace(
              '<script src="../dist/bundle.js"></script>',
              `<script>${bundledJS}</script>`
          ).replace(
              '<link rel="stylesheet" href="../dist/bundle.css">',
              `<style>${bundledCSS}</style>`
          ).replaceAll(
              '$__{octane-game-title}__$',
              gameTitle
          );

    fs.writeFileSync('dist/index.html', html);
    console.log("...Done!");
}

(async () => {
    try {
        console.log("Batch started!");
        await esbuild.build(buildConfig);
        await buildHTML();
        console.log("Batch complete!");
    } catch (error) {
        console.error("OOPS: ", error);
        process.exit(1);
    }
})();
