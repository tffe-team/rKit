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
## 配置文件选项 参考
https://cli.vuejs.org/zh/config/#%E5%85%A8%E5%B1%80-cli-%E9%85%8D%E7%BD%AE

## 命令 rui-rkit help

- init - 初始化项目
- serve - 启动服务
- build - 生产环节编译
- inspect - 生存webpack 配置
- lint - 检测代码