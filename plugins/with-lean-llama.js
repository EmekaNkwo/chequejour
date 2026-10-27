/**
 * Leaves out llama.rn builds the app never loads (about 47 MB). The model runs on the CPU
 * only (n_gpu_layers: 0), so the Snapdragon GPU/NPU build and its NPU files are unused.
 * Phones since about 2018 have the dotprod instructions and load one of the two dotprod
 * builds; an older phone falls back to the generic build, which is slower but works.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// with-lean-llama';
const UNUSED = ['v8', 'v8_2', 'v8_2_i8mm', 'v8_2_dotprod_i8mm_hexagon_opencl'];

function packagingBlock() {
  const libs = UNUSED.flatMap((v) => [`'**/librnllama_${v}.so'`, `'**/librnllama_jni_${v}.so'`]);
  return [
    `${MARKER}`,
    'android {',
    '    packagingOptions {',
    `        jniLibs { excludes += [${libs.join(', ')}] }`,
    '    }',
    '    androidResources {',
    "        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~:<dir>ggml-hexagon'",
    '    }',
    '}',
  ].join('\n');
}

module.exports = function withLeanLlama(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents = `${mod.modResults.contents}\n${packagingBlock()}\n`;
    }
    return mod;
  });
};
