#!/usr/bin/env node

/**
 * 火山引擎配置验证脚本
 * 用于检查环境变量和 API 连接
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = __dirname

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
}

console.log('\n🔍 火山引擎配置验证\n')

// 1. 检查 .env.local 文件
console.log('1️⃣  检查环境配置文件...')
const envLocalPath = path.join(rootDir, '.env.local')
if (fs.existsSync(envLocalPath)) {
  log.success('.env.local 文件存在')
  
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  
  // 检查必要的配置项
  const requiredVars = [
    'VITE_VOLCANO_API_KEY',
    'VITE_VOLCANO_ACCOUNT',
    'KINLOOP_VOLCANO_API_KEY',
  ]
  
  let allVarsPresent = true
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      const regex = new RegExp(`${varName}=(.+)`)
      const match = envContent.match(regex)
      if (match && match[1] && match[1] !== 'your_api_key_here') {
        log.success(`${varName} 已配置`)
      } else {
        log.warn(`${varName} 未填写实际值`)
        allVarsPresent = false
      }
    } else {
      log.error(`${varName} 未配置`)
      allVarsPresent = false
    }
  })
  
  if (!allVarsPresent) {
    console.log('\n请编辑 .env.local 文件，填入实际的 API Key')
  }
} else {
  log.error('.env.local 文件不存在')
  log.info('请基于 .env.example 创建 .env.local 文件')
}

// 2. 检查 .env.example 文件
console.log('\n2️⃣  检查环境变量示例文件...')
const envExamplePath = path.join(rootDir, '.env.example')
if (fs.existsSync(envExamplePath)) {
  log.success('.env.example 文件存在')
} else {
  log.warn('.env.example 文件不存在（不影响功能，但建议创建）')
}

// 3. 检查 .gitignore 配置
console.log('\n3️⃣  检查 Git 安全配置...')
const gitignorePath = path.join(rootDir, '.gitignore')
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
  
  if (gitignoreContent.includes('.env')) {
    log.success('.env* 文件已添加到 .gitignore')
  } else {
    log.error('.env* 文件未添加到 .gitignore')
    log.warn('⚠️  敏感信息可能被提交到 Git!')
  }
} else {
  log.error('.gitignore 文件不存在')
}

// 4. 检查后端配置文件
console.log('\n4️⃣  检查后端服务配置...')
const serverConfigPath = path.join(rootDir, 'server', 'config.mjs')
if (fs.existsSync(serverConfigPath)) {
  const configContent = fs.readFileSync(serverConfigPath, 'utf8')
  
  if (configContent.includes('VOLCANO_API_KEY')) {
    log.success('server/config.mjs 已配置火山引擎 API Key')
  } else {
    log.error('server/config.mjs 未配置火山引擎 API Key')
  }
} else {
  log.error('server/config.mjs 文件不存在')
}

// 5. 检查火山引擎路由文件
console.log('\n5️⃣  检查火山引擎 API 路由...')
const volcanoRoutesPath = path.join(rootDir, 'server', 'routes', 'volcanoRoutes.mjs')
if (fs.existsSync(volcanoRoutesPath)) {
  log.success('server/routes/volcanoRoutes.mjs 文件存在')
} else {
  log.error('server/routes/volcanoRoutes.mjs 文件不存在')
}

// 6. 检查前端 API 文件
console.log('\n6️⃣  检查前端 API 集成...')
const volcanoApiPath = path.join(rootDir, 'src', 'services', 'api', 'volcanoApi.ts')
if (fs.existsSync(volcanoApiPath)) {
  log.success('src/services/api/volcanoApi.ts 文件存在')
} else {
  log.error('src/services/api/volcanoApi.ts 文件不存在')
}

// 7. 检查文档
console.log('\n7️⃣  检查集成指南...')
const guidePath = path.join(rootDir, 'docs', 'VOLCANO_INTEGRATION_GUIDE.md')
if (fs.existsSync(guidePath)) {
  log.success('docs/VOLCANO_INTEGRATION_GUIDE.md 文件存在')
} else {
  log.warn('docs/VOLCANO_INTEGRATION_GUIDE.md 文件不存在（建议阅读）')
}

// 最终总结
console.log('\n📋 验证总结\n')
log.info('如果所有检查都通过，您可以开始使用火山引擎 API')
log.info('如有失败项目，请参考 VOLCANO_SETUP_COMPLETE.md')

console.log('\n下一步:')
console.log('1. npm run dev          # 启动前端开发服务器')
console.log('2. npm run dev:server   # 启动后端 API 服务')
console.log('3. 查看 docs/VOLCANO_INTEGRATION_GUIDE.md 了解详细用法\n')
