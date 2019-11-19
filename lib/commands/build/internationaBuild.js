const fs = require('fs-extra')
const path = require('path')
let pageKeys = []
let publicPath = ''
module.exports = function internationaBuild(outputDir, options, domainList) {
  pageKeys = Object.keys(options.pages)
  publicPath = options.publicPath
  console.log('files')
  domainList.map(item => {
    if(fs.existsSync(`${outputDir}/${item.path}`)) {
      deleteDirectory(`${outputDir}/${item.path}`);
    }
    fs.mkdirSync(`${outputDir}/${item.path}/`);
    console.log('\n')
    copyDirectory(`${outputDir}/${options.assetsDir}`, `${outputDir}/${item.path}/${options.assetsDir}`, item);
  })
  // 防止上面文件操作太慢导致的误删，监听最后一个文件夹是否创建作为删除的标记（这种处理也有小概率误差）
  const lastFolderName = domainList.slice(-1)[0].path
  const interval = setInterval(() => {
    if(fs.existsSync(`${outputDir}/${lastFolderName}/${options.assetsDir}`)) {
      deleteDirectory(`${outputDir}/${options.assetsDir}`)
      clearInterval(interval)
    }
  }, 20)
}
function copyDirectory(from, to, domainInfo) {
  if (!fs.existsSync(from)) {
    return;
  }
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to)
  }
  // 拷贝新的内容进去
  const dirs = fs.readdirSync(from);
  dirs.forEach((item) => {
    const item_path = path.join(from, item);
    const temp = fs.statSync(item_path);
    if (temp.isFile()) { // 是文件
      detailFile(item_path, path.join(to, item), domainInfo);
    } else if (temp.isDirectory()){ // 是目录
      copyDirectory(item_path, path.join(to, item), domainInfo);
    }
  })
}
function deleteDirectory(dir) {
  if (fs.existsSync(dir) == true) {
      const files = fs.readdirSync(dir);
      files.forEach(item => {
          const item_path = path.join(dir, item);
          if (fs.statSync(item_path).isDirectory()) {
              deleteDirectory(item_path);
          }
          else {
              fs.unlinkSync(item_path);
          }
      });
      fs.rmdirSync(dir);
  }
}
function detailFile(oldFile, newFile, domainInfo) {
  let needDealFile = /\.json$/.test(oldFile) || /\.js$/.test(oldFile);
  let isPage = true;
  if(/\.js$/.test(oldFile) && pageKeys.length) {
    // 此处不是很严谨 暂时这么做
    pageKeys.map((page) => {
      const reg = new RegExp(page, 'g')
      isPage = reg.test(oldFile) // 只需要针对pages的key对应的js文件做处理
    }) 
  }
  if(needDealFile && isPage) {
    fs.readFile(oldFile, (err, data) => {
      if(err) {
        console.log(err);
        return;
      }
      const content = data.toString().replace(new RegExp(publicPath, 'g'), `${domainInfo.domain}/${domainInfo.path}/`)
      if(/staticPath\.json$/.test(oldFile)){
        newFile = path.join(newFile, '../../staticPath.json')
      }
      fs.writeFile(newFile, content, err => {
        if(err) {
          console.log(err);
          return;
        }
      })
    })
  } else {
    fs.copyFileSync(oldFile, newFile)
  }
  console.log(`     ${newFile}`)
}
