const fs = require('fs')
const path = require('path');
const util = require('util')
const fse = require('fs-extra')
const SentryCli = require('@sentry/cli')
const child_process = require('child_process')

var http = require("http");
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
      '--mode': 'specify env mode (default: production)',
      '--sentry': 'upload sourcemap to sentry'
    }
  }, async (args) => {
    const { sentry } = args
    const distDir = api.resolve(options.outputDir)
    
    const exists = await fse.pathExists(distDir)

    if(!exists) {
      error(`构建文件不存在，请先进行 npm run build`)
      return false
    }

    if (sentry) {

      if(!options.productionSourceMap) {
        error(`请先在rkit.config.js内配置：productionSourceMap: true，即编译生成sourceMap文件。`)
        return false
      }
      const existSourMap = readFileList(distDir).some(path => /.+(.js.map)$/ig.test(path))
      if(!existSourMap) {
        error(`${options.outputDir}下未找到sourceMap文件，请先 npm run build`)
        return false
      }
      uploadSourceMaps(options).then(() => {
        child_process.execSync(`rm -rf ${distDir}/**/js/*.js.map`) // 删除sourcemap
      })
      return
    }
    const { assetsDir: version } = options
    if (!options.syncHost) {
      error(`请先在rkit.config.js内配置：syncHost字段。例如：syncHost: 10.12.17.48`)
      return false
    }
    if (!options.projectName) {
      error(`请先在rkit.config.js内配置：projectName字段，即项目名`)
      return false
    }
    const syncApiOption = {
      port: 3000,
      path: '/file_upload',
      host: options.syncHost,
      projectName: options.projectName
    }
    try{
      await exec(`zip ${version}.zip -q -r */`, { cwd: distDir })
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
  const cli = new SentryCli(),
        version = process.env.VUE_APP_SENTRY_RELASE,
        urlReg = /(\/{0,3})([0-9.\-A-Za-z]+)(:\d+)?(?:\/([^?#]*))?/ig
  const patternResult = urlReg.exec(publicPath)  

  const urlPath = patternResult[4] || ''

  info(`sentry发布版本:${version}\n`)

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

module.exports.defaultModes = {
  sync: 'production'
}