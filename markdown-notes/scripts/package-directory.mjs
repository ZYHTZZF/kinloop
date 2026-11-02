import { resolve, dirname, basename } from 'node:path';

// Build beside a running installation instead of removing its locked files.
export function packageDirectory() {
  const output = resolve(
    process.env.MARKITDOWN_PACKAGE_DIR ||
      process.env.ZHIYE_PACKAGE_DIR ||
      'release/Mark-It-Down-win-x64',
  );
  if (
    dirname(output) !== resolve('release') ||
    !/^Mark-It-Down(?:-v\d+\.\d+\.\d+)?-win-x64$/.test(basename(output))
  )
    throw new Error('打包输出必须是当前项目release目录中的Mark It Down成品目录');
  return output;
}
