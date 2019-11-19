module.exports = function formatStats(stats, dir, api, options) {
        const fs = require('fs')
        const fsExt = require('fs-extra')
        const path = require('path')
        const zlib = require('zlib')
        const chalk = require('chalk')
        const ui = require('cliui')({ width: 80 })

        const json = stats.toJson({
            hash: false,
            modules: false,
            chunks: false
        })
        let assets = json.assets ?
            json.assets :
            json.children.reduce((acc, child) => acc.concat(child.assets), [])
        const configInfo = {
            "javascript": [],
            "css": []
        }
        const staticPathInfo = {
            "staticPath": `http:${options.publicPath}${options.assetsDir}/config.json`
        }
        const seenNames = new Map()
        const isJS = val => /\.js$/.test(val)
        const isCSS = val => /\.css$/.test(val)
        const isMinJS = val => /\.min\.js$/.test(val)
        const isCommon = val => /chunk/.test(val)
        let chunks = ['chunk-vendors', 'chunk-common']
        if (Object.keys(options.pages).length) {
            Object.keys(options.pages).forEach(name => {
                chunks.push(name)
            });
        }
        assets = assets
            .filter(a => {
                if (seenNames.has(a.name)) {
                    return false
                }
                seenNames.set(a.name, true)
                return isJS(a.name) || isCSS(a.name)
            })
            .sort((a, b) => {
                if (isJS(a.name) && isCSS(b.name)) return -1
                if(isCSS(a.name) && isCommon(a.name)) return -1
                if(isJS(a.name) && isCommon(a.name)) return -1
                if (isCSS(a.name) && isJS(b.name)) return 1
                if (isMinJS(a.name) && !isMinJS(b.name)) return -1
                if (!isMinJS(a.name) && isMinJS(b.name)) return 1
                return b.size - a.size
            })

        function formatSize(size) {
            return (size / 1024).toFixed(2) + ' KiB'
        }

        function getGzippedSize(asset) {
            const filepath = api.resolve(path.join(dir, asset.name))
            const buffer = fs.readFileSync(filepath)
            return formatSize(zlib.gzipSync(buffer).length)
        }

        function makeRow(a, b, c) {
            return `  ${a}\t    ${b}\t ${c}`
        }

        ui.div(
            makeRow(
                chalk.cyan.bold(`File`),
                chalk.cyan.bold(`Size`),
                chalk.cyan.bold(`Gzipped`)
            ) + `\n\n` +
            assets.map(asset => makeRow(
                (() => {
                    chunks.forEach((key) => {
                        const reg = new RegExp(key)
                        if (reg.exec(asset.name)) {
                            if (/js$/.test(asset.name)) {
                                configInfo.javascript.push(options.publicPath + asset.name)
                            } else {
                                configInfo.css.push(options.publicPath + asset.name)
                            }
                        }
                    })
                    return chalk.blue(path.join(dir, asset.name))
                })(),
                formatSize(asset.size),
                getGzippedSize(asset)
            )).join(`\n`))
        return {
            staticPathInfo,
            configInfo,
            logInfo:  `${ui.toString()}\n\n  ${chalk.gray(`Images and other types of assets omitted.`)}\n`
        }
}
