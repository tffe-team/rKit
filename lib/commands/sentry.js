const util = require('util')
const SentryCli = require('@sentry/cli')
const fs = require('fs')
const fse = require('fs-extra')

var http = require("http");
const { 
  error,
  info,
  stopSpinner,
  logWithSpinner
} = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)

module.exports = (api, options) => {
  api.registerCommand('sentry', {
    description: 'sentry',
  }, async () => {
    uploadSourceMaps(
      process.env.VUE_APP_SENTRY_RELASE,
      options.outputDir
    )
  })
}

async function uploadSourceMaps(version, outputDir) {
  const cli = new SentryCli()
  info(`sentry发布版本${version}\n`)

  const options = {
    debug: false,
    include: [`./${outputDir}/d3c57059b0f5382e47c99bc944fd31ee/js`],
    urlPrefix: '~/tfstatic/easyLoan/js',
    rewrite: true,
    ignore: ['node_modules']
  };

  console.log('upload options:\n', options);

  await cli.releases.new(version);
  await cli.releases.uploadSourceMaps(version, options);
  await cli.releases.finalize(version);
}


module.exports.defaultModes = {
  sentry: 'production'
}