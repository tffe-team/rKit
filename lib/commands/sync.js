const util = require('util')
const fs = require('fs')

var http = require("http");
const { 
  error,
  info,
  stopSpinner,
  logWithSpinner
} = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)

module.exports = (api, options) => {
  api.registerCommand('sync', async () => {
    if (!options.syncHost) {
      error(`请先在rkit.config.js内配置：syncHost字段。例如：syncHost: 10.12.17.48`)
      return false
    }
    const distDir = api.resolve(options.outputDir)
    const syncApiOption = {
      port: 3000,
      path: '/file_upload',
      host: options.syncHost,
      projectName: options.projectName
    }
    try{
      fs.accessSync(distDir, fs.F_OK)
      await exec(`zip dist.zip -q -r */`, { cwd: distDir })
      await syncFile(syncApiOption, `${distDir}/dist.zip`)
    } catch (err){
      error(`构建文件不存在，请先进行 npm run build${err}`)
      return false
    }
  })
}

async function syncFile(syncOption, filePath) {
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
        console.log('\r\n')
        info('同步文件成功')
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
    `Content-Disposition: form-data; name="file"; filename="dist.zip"\r\n` +
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

function generateBoundary() {
  return `---------------------------${new Date().valueOf().toString(32)}`
}