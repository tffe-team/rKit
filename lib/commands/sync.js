const fs = require('fs')
const path = require('path')
const http = require("http")
const util = require('util')
const fse = require('fs-extra')
const SentryCli = require('@sentry/cli')
const child_process = require('child_process')

const { 
  error,
  info,
  stopSpinner,
  logWithSpinner
} = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)

module.exports = (api, options) => {
  api.registerCommand('sync', {
    description: 'sync static files to remote host',
    usage: 'rkit sync [options]',
    options: {
      '--sentry': 'upload sourcemap to sentry'
    }
  }, async (args) => {
    const { sentry } = args
    const distDir = api.resolve(options.outputDir),
          deployInfoDir = `${process.env.PWD}/.sentryVariable`

    const existsDist = await fse.pathExists(distDir),
          existsDeployInfo = await fse.pathExists(deployInfoDir)
    if(!existsDist) {
      error(`构建文件不存在，请先执行 npm run build`)
      return false
    }

    if (sentry) {
      const existSourMap = readFileList(distDir).some(path => /.+(.js.map)$/ig.test(path))

      if(!existsDeployInfo) {
        error(`deploy.json 不存在，请重新执行 npm run build 生成`)
        return false
      }

      if(!options.productionSourceMap) {
        error(`请先开启SourceMap生成\n`)
        info('请尝试以下操作解决：\n')
        console.log('    * 在rkit.config.js内配置: productionSourceMap: true\n')
        return false
      }

      if(!existSourMap) {
        error(`请确认dist目录下是否存在sourceMap\n`)
        info('请尝试以下操作解决：\n')
        console.log('    * 执行 npm run build 重新打包生成sourceMap文件\n')
        return false
      }

      resolveEnvInfo(deployInfoDir)
      uploadSourceMaps(options).then(() => {
        child_process.execSync(`rm -rf ${distDir}/**/js/*.js.map`) // 删除sourcemap
        child_process.execSync(`rm -rf ${deployInfoDir}`) // 删除env信息记录
        info(`上传sourceMap到Sentry成功`)
      })
      return
    }
    const { assetsDir: version } = options
    if (!options.syncHost) {
      error(`rkit.config.js未配置syncHost\n`)
      info('请尝试以下操作解决：\n')
      console.log('    * 在rkit.config.js内配置: syncHost: 10.0.0.1\n')
      return false
    }
    if (!options.projectName) {
      error(`rkit.config.js未配置项目名\n`)
      info('请尝试以下操作解决：\n')
      console.log('    * 在rkit.config.js内配置: projectName: name\n')
      return false
    }
    const syncApiOption = {
      port: 3000,
      path: '/file_upload',
      host: options.syncHost,
      projectName: options.projectName
    }
    try{
      await exec(`zip ${version}.zip -x *.map -q -r */`, { cwd: distDir })
      await syncFile(syncApiOption, `${distDir}/${version}.zip`, version)
    } catch (err){
      error(`压缩静态文件出错！`)
      return false
    }
  })
}

function generateBoundary() {
  return `---------------------------${new Date().valueOf().toString(32)}`
}

function readFileList(dir, filesList = []) {
  const files = fs.readdirSync(dir)
  files.forEach(item => {
    var fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {   
      readFileList(path.join(dir, item), filesList)
    } else {        
      filesList.push(fullPath)         
    }    
  })
  return filesList
}

async function syncFile(syncOption, filePath, version) {
  const boundary = generateBoundary()
  const { host, port, path, projectName } = syncOption
  const options = {
    method: "POST",
    host: host,
    port: port,
    path: path,
    headers: {
      "Transfer-Encoding": "chunked",
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    }
  }
  logWithSpinner(`正在同步静态文件到：${host}`)
  const req = http.request(options, (res) => {
    res.on('data', data => {
      const res = JSON.parse(data.toString())
      if (+res.status === 0) {
        const data = res.data
        console.log('\r\n')
        fse.remove(filePath)
        info(`同步文件成功，存储目录为:${data.filePath}`)
      } else {
        error('同步文件失败：', res.msg)
      }
      stopSpinner(false)
    })
  })
  req.on('error', err => {
    stopSpinner(false)
    error(`同步文件失败，请检查${host}服务是否正常`)
  })

  req.write(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="projectName"\r\n\r\n${projectName}\r\n` +
    `--${boundary}\r\n` + 
    `Content-Disposition: form-data; name="file"; filename="${version}.zip"\r\n` +
    `Content-Transfer-Encoding: binary \r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`
  )

  const enddata  = '\r\n--' + boundary + '--'
  const fileStream = fs.createReadStream(filePath, { bufferSize: 4 * 1024 })
  
  fileStream.pipe(req, { end: false })
  fileStream.on('end', () => {
    req.end(enddata)
  })
}

async function uploadSourceMaps(options) {
  const { outputDir, publicPath } = options
  const cli = new SentryCli(null, { silent: true }),
        version = process.env.VUE_APP_DEPLOY_VESION,
        urlReg = /(\/{0,3})([0-9.\-A-Za-z]+)(:\d+)?(?:\/([^?#]*))?/ig
  const patternResult = urlReg.exec(publicPath)  

  const urlPath = patternResult[4] || ''

  info(`准备上传Sentry版本：${version}\n`)

  const config = {
    debug: false,
    include: [`./${outputDir}`],
    urlPrefix: `~/${urlPath}`,
    rewrite: true,
    ignore: ['node_modules']
  };
  await cli.releases.new(version);
  await cli.releases.uploadSourceMaps(version, config)
  await cli.releases.finalize(version);
}

function resolveEnvInfo(dir) {
  const envInfo = fse.readJsonSync(dir)
  const { VUE_APP_DEPLOY_VESION } = envInfo
  process.env.VUE_APP_DEPLOY_VESION = VUE_APP_DEPLOY_VESION
}

module.exports.defaultModes = {
  sync: 'production'
}