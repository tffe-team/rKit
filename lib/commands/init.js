'use strict';
const download = require('download-git-repo');
const ora = require('ora');
const inquirer = require('inquirer')

module.exports = (api, options) => {
  api.registerCommand('init', {
    description: 'create a project',
  }, args => {
    const prompt = inquirer.createPromptModule();
    prompt([{
      type: 'list',
      message: 'Please select a template type',
      name: 'line',
      choices: ['vue-h5-app', 'vue-pc-app'],
    }]).then(function(answers) {
      pullTpl(answers.line)
    });
  })
  function pullTpl(tplType) {
    switch(tplType) {
      case 'vue-h5-app':
        pullVueH5Tpl();
      break;
      case 'vue-pc-app':
        pullVuePcTpl();
      break;
    }
  };
  function pullVueH5Tpl() {
    const spinner = new ora({});
    spinner.start('创建vue-h5-app模版');
    setTimeout(() => {
      spinner.color = 'yellow';
      spinner.text = '远程拉取模版';
    }, 1000);
    download('direct:https://github.com/tffe-team/vue-h5-app.git', './', { clone: true }, function (err) {
      if(err) {
        //todo 非空目录判断
        spinner.fail(err)
      } else {
        spinner.succeed('创建成功')
        console.log('执行下面命令开始开发：');
        console.log('npm install && npm run dev');
      }
      spinner.stop();
    })
  };
  function pullVuePcTpl() {
    const spinner = new ora({});
    spinner.start('创建vue-pc-app模版');
    setTimeout(() => {
      spinner.color = 'yellow';
      spinner.text = '远程拉取模版';
    }, 1000);
    // console.log(process.cwd())
    download('direct:https://github.com/tffe-team/vue-pc-app.git', './', { clone: true }, function (err) {
      if(err) {
        //todo 非空目录判断
        spinner.fail(err)
      } else {
        spinner.succeed('创建成功')
        console.log('执行下面命令开始开发：');
        console.log('npm install && npm run dev');
      }
      spinner.stop();
    })
  }
}