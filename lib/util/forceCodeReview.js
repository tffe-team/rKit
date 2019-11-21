#!/usr/bin/env node
const util = require('util')
const chalk = require('chalk')
const exec = util.promisify(require('child_process').exec)


function findRevesion(rawMsg) {
  const re = new RegExp('/D(\\w*)', 'g')
        msg = rawMsg.replace(/[\r\n]/g,'')
  const result = re.exec(msg)
  if (!result || !result[1]) { return null }
  return result[1]
}

async function findCommitRange(branch) {
  const {stdout: originRaw } = await exec(`git reflog show ${branch}`)
  const origin = originRaw.replace(/[\r\n]/g,''),
        re = new RegExp(`(\\w{7})\\s${branch}`, 'g');
  const commits = []
  while((commit = re.exec(origin)) !== null) {
    commits.push(commit[1])
  }
  return commits.reverse()
}

async function checkReviewBy(revesionId) {
  let isReviewed = false
  try {
    let { stdout: querydiffsout } = await exec(`echo '{
      "ids": [${revesionId}]
    }' | arc call-conduit differential.query`, {maxBuffer: Infinity})
    const data = JSON.parse(querydiffsout)
    if (data.response && data.response[0]) {
      isReviewed = data.response[0].statusName === 'Accepted'
    }
  } catch (error) {
    console.log(chalk.red(`${error}`))
    throw new Error(error)
  }
  return isReviewed
}

async function monitorUpdate(revesionId, lastCommit) {
  console.log(chalk.red(`匹配到DIFF版本：D${revesionId}`))
  try {
    let needUpdate = false
    let { stdout: querydiffsout } = await exec(`echo '{
      "ids": [${revesionId}]
    }' | arc call-conduit differential.query`, {maxBuffer: Infinity})
    const data = JSON.parse(querydiffsout)
    if (data.response && data.response[0]) {
      const hash = data.response[0].hashes
      for (let i = 0, len = hash.length; i < len; i++) {
        const hashCode = hash[i][1] || ''
        needUpdate = true
        if(hashCode.indexOf(lastCommit) !== -1) {
          needUpdate = false
          break
        }
      }
    }
    return needUpdate

  } catch (error) {
    console.log(chalk.red(`${error}`))
    throw new Error(error)
  }
}

async function detectMasterUpdate(branch) {
  try {
    let { stdout: orginMasterHash } = await exec(`git rev-parse --verify origin/master`)
    if(!orginMasterHash) {
      throw new Error('远端 master 不存在')
    }
    await exec(`git fetch origin`)
    const { stdout: branchLog } = await exec(`git log --grep="${branch}"`, {maxBuffer: Infinity})
    if (branchLog.indexOf(`Merge branch '${branch}' into 'master'`) !== -1) {
      console.log(chalk.red('注意：当前分支已上线！'))
    }
    const getLostCommand = `git rev-list --left-right --count origin/master...${branch} | cut -f1`
    let { stdout: loseCommitCount } = await exec(getLostCommand)
    return Number.parseInt(loseCommitCount)
  } catch(error) {
    console.log(chalk.red(`请检查远端仓库是否存在！`))
    throw new Error(error)
  }
}

async function forceCodeReview() {
  
  try {
    const {stdout: branchRaw } = await exec(`git status | grep 'On branch' | awk '{print $NF}'`)
    const branch = branchRaw.trim()
    if(branch.trim() === 'master') {
      return true
    }
    
    let revesionId = null,
        isReviewBy = false
    const loseCommitCount = await detectMasterUpdate(branch)
    if(loseCommitCount > 0) {
      throw new Error(`当前分支落后 master ${loseCommitCount}个提交，请先merge master`)
    }

    const commits = await findCommitRange(branch)

    for(let i = 0, len = commits.length; i < len; i++) {
      const commit = commits[i]
      let {stdout: commitRaw } = await exec(`git rev-list --format=%B --max-count=1 ${commit}`)
      if(commitRaw.indexOf('Differential Revision') !== -1) { // 已经创建cr
        revesionId = findRevesion(commitRaw)
        if (!isReviewBy && revesionId) {
          isReviewBy = await checkReviewBy(revesionId)
        }
      }
      if(i === len - 1 && isReviewBy && revesionId) {
        const needUpdate = await monitorUpdate(revesionId, commit)
        if (needUpdate) {
          console.log(chalk.red(`最新的修改暂未arc update 使用 arc diff master --update D${revesionId} 进行更新`))
        }
      }
    }
    if (isReviewBy) {
      return true
    } else {
      throw new Error('build代码之前请先通过code review!')
    }
  } catch (error) {
    console.log(chalk.red(error))
    return false
  }
}

module.exports = forceCodeReview