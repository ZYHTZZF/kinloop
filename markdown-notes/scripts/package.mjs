import { cp, mkdir, writeFile, rename, stat, rm, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { packageDirectory } from './package-directory.mjs';
const directory = packageDirectory();
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const output = resolve(directory);
await rm(output, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
await cp('node_modules/electron/dist', directory, { recursive: true });
await mkdir(join(directory, 'resources/app'), { recursive: true });
await cp('dist', join(directory, 'resources/app/dist'), { recursive: true });
await writeFile(
  join(directory, 'resources/app/package.json'),
  JSON.stringify({
    name: 'mark-it-down',
    productName: 'Mark It Down',
    version,
    main: 'dist/main.cjs',
  }),
);
try {
  await rename(join(directory, 'electron.exe'), join(directory, 'Mark It Down.exe'));
} catch (e) {
  if (!(await stat(join(directory, 'Mark It Down.exe')).catch(() => null))) throw e;
}
await writeFile(
  join(directory, '使用说明.txt'),
  'Mark It Down · 个人 Markdown 笔记与知识管理工具\r\n\r\n双击“Mark It Down.exe”启动，无需安装Node，基础笔记功能可离线使用。远程AI需联网并在设置中填写自己的API地址、模型与Key。请保持同目录资源文件完整。\r\n个人资料存放位置可在软件设置中查看。移动程序目录不会自动移动资料。\r\n迁移资料请先创建完整备份，再在目标设备执行恢复。备份ZIP默认不加密。\r\n新建 Ctrl+N，保存 Ctrl+S，搜索 Ctrl+K。\r\n程序无代码签名；源码、测试报告和设计文档位于项目交付目录。\r\n',
  'utf8',
);
await cp('THIRD-PARTY-NOTICES.txt', join(directory, 'THIRD-PARTY-NOTICES.txt'));
console.log(directory);
