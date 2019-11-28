# rui-rkit

rui-rkit 是一个基于 Webpack 的打包工具，它利用插件机制封装了各种 JavaScript 应用的配置，选择和安装合适的插件即可开始构建你的应用。


## 安装

- latest 稳定版: `[sudo] npm install rui-rkit -g`

## node.js 版本
- node >=8

## 快速开始

1. 创建目录 `mkdir rkit-app && cd rkit-app`
2. 初始化工程 `rui-rkit init` 选择模版
3. 安装依赖 `npm install`
4. 启动服务 `npm run dev`
初始化结束后，项目中会生成一个名为 `rkit.config.js` 的配置文件：
## hooks
新增hooks配置  
```
hooks:{
  brefore: (config) => {},  //编译前钩子
  after: (config) => {} //编译后钩子
}
```
## 支持国际化打包
```
domainList: [{
  domain: `/[/test.xxx.comn`, //域名
  path: 'en', //目录
  isBuild: true // 是否编译
}]
// 生成目录为dist/en/xxxx(版本号)
// 注意：如何domainList存在isBuild为true的选项时会覆盖publicPath打包结果
```

## 支持强制DIFF流程
- 请在rkit.config.js中配置，例如： `projectName: 'easyLoan'`
- 分支生成的DIFF,必须在codereview平台被他人通过才能进行npm run build
- npm run build 选择分支可以指定分支md5 作为版本号

注：老版本中，原有的*build/prod.env.js*已经废弃，更新后可以删除

## 支持同步静态文件
- 请在rkit.config.js中配置，例如： `syncHost: '10.1.1.1'`
- 运行`rui-rkit sync`,将会上传到配置的*syncHost*该主机内，并在控制台返回存储路径

## 支持同步SourceMap到Sentry

需要支持Sentry平台，请在项目根目录中新建文件：
```
// .sentryclirc

[defaults]
project=sentry项目名
url=sentry服务地址
org=sentry组织名

[auth]
token=你的token
```

```
// .env.production  ==> production环境
NODE_ENV=production
VUE_APP_SENTRY_ENV=prod
VUE_APP_SENTRY_RELASE=你production环境的版本号
```

```
// .env.beta  ==> beta环境
NODE_ENV=production
VUE_APP_SENTRY_ENV=beta
VUE_APP_SENTRY_RELASE=你beta环境的版本号
```

运行 `rui-rkit sync --sentry`将上传并发布sentry版本号，需要支持sentry env，新建对应的`.env.xxx`的配置文件，使用`rui-rkit sync --sentry --mode xxx`,其中xxx表示对应的环境名。



## 配置文件选项 参考
https://cli.vuejs.org/zh/config/#%E5%85%A8%E5%B1%80-cli-%E9%85%8D%E7%BD%AE

## 命令 rui-rkit help

- init - 初始化项目
- serve - 启动服务
- build - 生产环节编译
- inspect - 生存webpack 配置
- lint - 检测代码
- sync - 上传静态文件和sourcemap

## change log  
1.修复staticPath文件缺少冒号问题    
2.新增hooks配置
3.config文件生成样式文件顺序错乱的问题，新增pc模版
4.新增强制codereview流程
5.新增上传静态文件到远程主机
6.新增上传soucemap到sentry服务