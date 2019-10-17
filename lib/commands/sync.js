const util = require('util')
const fs = require('fs')
var http = require("http");
const chalk = require('chalk')
const { error } = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)

function File(filename, filepath) {
  this.filename = filename;
  this.filepath = filepath;
  this._buffer = null;
}

File.prototype.getBuffer = function () {
  if (!this._buffer) {
      this._buffer = fs.readFileSync(this.filepath);
  }
  return this._buffer;
}


module.exports = (api, options) => {
  api.registerCommand('sync', async (args) => {
    const distDir = api.resolve(options.outputDir)
    try{
      fs.accessSync(distDir, fs.F_OK)
      console.log(options, 'options')
      await exec(`zip dist.zip -q -r */`, { cwd: distDir })
      await syncFile(options.projectName, options.syncApiUrl, `${distDir}/dist.zip`)
    } catch (e){
      // error(`构建文件不存在，请先进行 npm run build`, e)
      console.log(e, 'r')
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
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    }
  }
  console.log(options, 'options')
  const req = http.request(options, (res) => {
    res.on('data', data => {
      console.log('data', data.toString())
    })
  })
  req.on('error', error => {
    console.log('error', error)
  })

  req.write(`--${boundary}\r\n`  +
    `Content-Disposition: form-data; name="file"; filename=dist\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  )
  req.write(fs.readFileSync(filePath))
  console.log(projectName, 'projectName')
  req.write(`--${boundary}\r\n` +
    `Content-Disposition: form-data; name="projectName"\r\n\r\n${projectName}\r\n`
  )
  req.write(`\r\n--${boundary}--\r\n`)
  req.end()
}


function generateBoundary() {
  return `---------------------------${Math.random().toString(32)}`
}