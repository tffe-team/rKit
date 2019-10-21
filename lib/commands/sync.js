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
  api.registerCommand('sync', async (args) => {
    const distDir = api.resolve(options.outputDir)
    try{
      fs.accessSync(distDir, fs.F_OK)
      await exec(`zip dist.zip -q -r */`, { cwd: distDir })
      await syncFile(options.projectName, options.syncApiUrl, `${distDir}/dist.zip`)
    } catch (e){
      error(`构建文件不存在，请先进行 npm run build`)
      return false
    }
  })
}

async function syncFile(projectName, apiUrl, filePath) {
  let url = apiUrl.replace('http://', '')
  const boundary = generateBoundary(),
        urlArr = url.split('/')
  const host = urlArr[0].split(':')[0],
        port = urlArr[0].split(':').length > 1 ? urlArr[0].split(':')[1] : 80;
  urlArr[0] = ''
  const path = urlArr.join('/')
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
  req.on('error', error => {
    stopSpinner(false)
    error('同步文件失败', error)
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
  return `---------------------------${Math.random().toString(32)}`
}