const fs = require('fs-extra')
const path = require('path')
let pageKeys = []
let publicPath = ''
module.exports = function internationaBuild(outputDir, options, domainList) {
  pageKeys = Object.keys(options.pages)
  publicPath = options.publicPath
  console.log('files \n')
  domainList.map(item => {
    if(fs.existsSync(`${outputDir}/${item.path}`)) {
      deleteDirectory(`${outputDir}/${item.path}`);
    }
    fs.mkdirSync(`${outputDir}/${item.path}/`);
    console.log('\n')
    copyDirectory(`${outputDir}/${options.assetsDir}`, `${outputDir}/${item.path}/${options.assetsDir}`, item);
  })
  setTimeout(()=>{
    deleteDirectory(`${outputDir}/${options.assetsDir}`)
  }, 0)
}
function copyDirectory(src, dest, curDomain) {
  if (fs.existsSync(dest) === false) {
    fs.mkdirSync(dest)
  }
  if (fs.existsSync(src) === false) {
    return false;
  }
  // 拷贝新的内容进去
  var dirs = fs.readdirSync(src);
  dirs.forEach((item) => {
    var item_path = path.join(src, item);
    var temp = fs.statSync(item_path);
    if (temp.isFile()) { // 是文件
        detailFile(item_path, path.join(dest, item), curDomain);
    } else if (temp.isDirectory()){ // 是目录
        copyDirectory(item_path, path.join(dest, item), curDomain);
    }
  })
}
function deleteDirectory(dir) {
  if (fs.existsSync(dir) == true) {
      var files = fs.readdirSync(dir);
      files.forEach(item => {
          var item_path = path.join(dir, item);
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
function detailFile(oldFile, newFile, curDomain) {
  let needDetailFile = /config\.json$/.test(oldFile) || /staticPath\.json$/.test(oldFile) || /\.js$/.test(oldFile)
  let isPage = true
  if(/\.js$/.test(oldFile) && pageKeys.length) {
    // 此处不是很严谨 暂时这么做
    pageKeys.map((page) => {
      const reg = new RegExp(page, 'g')
      if(reg.test(oldFile)) {
        isPage = true
      } else {
        isPage = false
      }
    })
  }
  if(needDetailFile && isPage) {
    fs.readFile(oldFile, (err, data) => {
      if(err) {
        console.log(err);
        return;
      }
      const content = data.toString().replace(new RegExp(publicPath, 'g'), `${curDomain.domain}/${curDomain.path}/`)
      if(/staticPath\.json$/.test(oldFile)){
        newFile = path.join(newFile, '../../staticPath.json')
      }
      fs.writeFile(newFile, content, (err) => {
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
