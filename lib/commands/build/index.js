const md5 = require('md5');
const fsExt = require('fs-extra')
const inquirer = require('inquirer')

const defaults = {
    clean: true,
    target: 'app',
    formats: 'commonjs,umd,umd-min',
    'unsafe-inline': true
}

const buildModes = {
    lib: 'library',
    wc: 'web component',
    'wc-async': 'web component (async)'
}

const modifyConfig = (config, fn) => {
    if (Array.isArray(config)) {
        config.forEach(c => fn(c))
    } else {
        fn(config)
    }
}

module.exports = (api, options) => {
    api.registerCommand('build', {
        description: 'build for production',
        usage: 'vue-cli-service build [options] [entry|pattern]',
        options: {
            '--mode': `specify env mode (default: production)`,
            '--dest': `specify output directory (default: ${options.outputDir})`,
            '--modern': `build app targeting modern browsers with auto fallback`,
            '--no-unsafe-inline': `build app without introducing inline scripts`,
            '--target': `app | lib | wc | wc-async (default: ${defaults.target})`,
            '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
            '--name': `name for lib or web-component mode (default: "name" in package.json or entry filename)`,
            '--no-clean': `do not remove the dist directory before building the project`,
            '--report': `generate report.html to help analyze bundle content`,
            '--report-json': 'generate report.json to help analyze bundle content',
            '--watch': `watch for changes`
        }
    }, async(args, rawArgs) => {
        const prompt = inquirer.createPromptModule();
        const { warn, error } = require('@vue/cli-shared-utils')
        const {
            getCurBranch,
            getBuildBranch,
        } = require('../../util/getBuildBranch')
        let branchs = await getBuildBranch(),
            curBranch = await getCurBranch(),
            envs = [
                'beta',
                'online'                
            ],
            branchIdx = branchs.indexOf(curBranch)
        if (branchIdx !== -1) {
            branchs.splice(branchIdx, 1)
            branchs.unshift(curBranch)
        }
        if(!options.projectName) {
            error(`请先在rkit.config.js内配置：projectName字段，即项目名。`)
            return false
        }


        await prompt([{
            type: 'list',
            message: 'Please select a branch as the version number',
            name: 'line',
            choices: branchs,
        }]).then(function(answers) {
            if (curBranch !== answers.line) {
                options.assetsDir = md5(answers.line)
                warn(
                    `当前分支为${curBranch}，` +
                    `正在使用分支${answers.line}的版本号：${options.assetsDir} 进行构建\n`
                )
            }
        });
        await prompt([{
            type: 'list',
            message: 'Please select you deploy environment',
            name: 'line',
            choices: envs,
        }]).then(function(answers) {
            const { line: env } = answers
            injectEnvInfo(env, curBranch)
        });
 
        for (const key in defaults) {
            if (args[key] == null) {
                args[key] = defaults[key]
            }
        }
        args.entry = args.entry || args._[0]
        if (args.target !== 'app') {
            args.entry = args.entry || 'src/App.vue'
        }

        process.env.VUE_CLI_BUILD_TARGET = args.target
        if (args.modern && args.target === 'app') {
            process.env.VUE_CLI_MODERN_MODE = true
            if (!process.env.VUE_CLI_MODERN_BUILD) {
                // main-process for legacy build
                await build(Object.assign({}, args, {
                        modernBuild: false,
                        keepAlive: true
                    }), api, options)
                    // spawn sub-process of self for modern build
                const { execa } = require('@vue/cli-shared-utils')
                const cliBin = require('path').resolve(__dirname, '../../../bin/vue-cli-service.js')
                await execa(cliBin, ['build', ...rawArgs], {
                    stdio: 'inherit',
                    env: {
                        VUE_CLI_MODERN_BUILD: true
                    }
                })
            } else {
                // sub-process for modern build
                await build(Object.assign({}, args, {
                    modernBuild: true,
                    clean: false
                }), api, options)
            }
            delete process.env.VUE_CLI_MODERN_MODE
        } else {
            if (args.modern) {
                const { warn } = require('@vue/cli-shared-utils')
                warn(
                    `Modern mode only works with default target (app). ` +
                    `For libraries or web components, use the browserslist ` +
                    `config to specify target browsers.`
                )
            }
            await build(args, api, options)
        }
        delete process.env.VUE_CLI_BUILD_TARGET
    })
}


function injectEnvInfo(curEnv, curBranch) {
    const { PWD } = process.env
    const version = curEnv === 'online' ? curBranch : `${curBranch}@${curEnv}`
    process.env.VUE_APP_DEPLOY_ENV = curEnv
    process.env.VUE_APP_DEPLOY_VESION = version
    fsExt.outputJsonSync(`${PWD}/.sentryVariable`, {
        VUE_APP_DEPLOY_ENV: curEnv,
        VUE_APP_DEPLOY_VESION: version
    }, { spaces: 2 })
}

async function build(args, api, options) {
    const fs = require('fs-extra')
    const path = require('path')
    const chalk = require('chalk')
    const webpack = require('webpack')
    const Config = require('webpack-chain')
    const formatStats = require('./formatStats')
    const internationBuild = require('./internationBuild')
    const createJsonFile = require('../../util/createJsonFile')
    const forceCodeReview = require('../../util/forceCodeReview')
    const validateWebpackConfig = require('../../util/validateWebpackConfig')
    const deleteDirectory = require('../../util/deleteDirectory')
    const {
        log,
        done,
        info,
        logWithSpinner,
        stopSpinner
    } = require('@vue/cli-shared-utils')
    if(!options.skipCodeReview) {
        const result = await forceCodeReview()
        if (!result) { process.exit(1) }
    }
    console.log("start building")
    const webpackConfigClass = new Config()
    if(typeof options.hooks.before === 'function') {
        options.hooks.before(webpackConfigClass)
    }
    log()
    const mode = api.service.mode
    if (args.target === 'app') {
        const bundleTag = args.modern ?
            args.modernBuild ?
            `modern bundle ` :
            `legacy bundle ` :
            ``
        logWithSpinner(`Building ${bundleTag}for ${mode}...`)
    } else {
        const buildMode = buildModes[args.target]
        if (buildMode) {
            const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
            logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
        } else {
            throw new Error(`Unknown build target: ${args.target}`)
        }
    }

    const targetDir = api.resolve(args.dest || options.outputDir)
    const isLegacyBuild = args.target === 'app' && args.modern && !args.modernBuild

    // resolve raw webpack config
    let webpackConfig
    if (args.target === 'lib') {
        webpackConfig = require('./resolveLibConfig')(api, args, options)
    } else if (
        args.target === 'wc' ||
        args.target === 'wc-async'
    ) {
        webpackConfig = require('./resolveWcConfig')(api, args, options)
    } else {
        webpackConfig = require('./resolveAppConfig')(api, args, options)
    }

    // check for common config errors
    validateWebpackConfig(webpackConfig, api, options, args.target)

    // apply inline dest path after user configureWebpack hooks
    // so it takes higher priority
    if (args.dest) {
        modifyConfig(webpackConfig, config => {
            config.output.path = targetDir
        })
    }

    if (args.watch) {
        modifyConfig(webpackConfig, config => {
            config.watch = true
        })
    }

    // Expose advanced stats
    if (args.dashboard) {
        const DashboardPlugin = require('../../webpack/DashboardPlugin')
        modifyConfig(webpackConfig, config => {
            config.plugins.push(new DashboardPlugin({
                type: 'build',
                modernBuild: args.modernBuild,
                keepAlive: args.keepAlive
            }))
        })
    }

    if (args.report || args['report-json']) {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
        modifyConfig(webpackConfig, config => {
            const bundleName = args.target !== 'app' ?
                config.output.filename.replace(/\.js$/, '-') :
                isLegacyBuild ? 'legacy-' : ''
            config.plugins.push(new BundleAnalyzerPlugin({
                logLevel: 'warn',
                openAnalyzer: false,
                analyzerMode: args.report ? 'static' : 'disabled',
                reportFilename: `${bundleName}report.html`,
                statsFilename: `${bundleName}report.json`,
                generateStatsFile: !!args['report-json']
            }))
        })
    }

    if (args.clean) {
        await fs.remove(targetDir)
    }

    return new Promise((resolve, reject) => {
        webpack(webpackConfig, (err, stats) => {
            stopSpinner(false)
            if (err) {
                return reject(err)
            }

            if (stats.hasErrors()) {
                return reject(`Build failed with errors.`)
            }
            if (!args.silent) {
                const targetDirShort = path.relative(
                    api.service.context,
                    targetDir
                )
                const formatStatsInfo = formatStats(stats, targetDirShort, api, options)
                let domainList = []
                if(options.domainList && options.domainList.length) {
                    domainList = options.domainList.filter(item => {
                        return item.isBuild === true
                    })
                }
                const staticPathInfo =  domainList.length ? path.join(targetDirShort, options.assetsDir + '/staticPath.json') : path.join(targetDirShort, '/staticPath.json')
                const configPathInfo = path.join(targetDirShort, options.assetsDir + '/config.json')
                log('  files\n')
                log(formatStatsInfo.logInfo)
                log('    config\n')
                createJsonFile(configPathInfo, formatStatsInfo.configInfo)
                createJsonFile(staticPathInfo, formatStatsInfo.staticPathInfo)
                domainList.length && internationBuild(targetDirShort, options, domainList)
                if (args.target === 'app' && !isLegacyBuild) {
                    if (!args.watch) {
                        if(!options.hooks.after && domainList.length) {
                            deleteDirectory(path.join(targetDirShort, options.assetsDir))
                        }
                        done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`)
                    } else {
                        done(`Build complete. Watching for changes...`)
                    }
                }
                if(typeof options.hooks.after === 'function') {
                    options.hooks.after(webpackConfigClass)
                }
            }

            // test-only signal
            if (process.env.VUE_CLI_TEST) {
                console.log('Build complete.')
            }

            resolve()
        })
    })
}
module.exports.defaultModes = {
    build: 'production'
}