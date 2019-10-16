const util = require('util')
const chalk = require('chalk')
const exec = util.promisify(require('child_process').exec)

module.exports = async function getBuildBranch() {
  const {stdout: originRaw } = await exec(`git branch --sort=-committerdate`)
  return originRaw.split(/[\s\n]/).filter(branch => {
    return ['', 'sort', '*'].indexOf(branch) === -1
  })
}