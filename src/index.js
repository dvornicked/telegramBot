const TelegramBot = require('node-telegram-bot-api')
const config = require('./config')
const helper = require('./helper')
const keyboard = require('./keyboard')
const kb = require('./keyboard-buttons')

const bot = new TelegramBot(config.TOKEN, {
    polling: true
})

helper.logStart()

bot.on('message', msg => {
    console.log('Working')

    switch (msg.text) {
        case kb.home.favourite:
            break
        case kb.home.films:
            break
        case kb.home.cinemas:
            break

    }
})

bot.onText('/\/start/', msg => {


    const text = `Hello, ${msg.from.first_name}\nChoose a team to get started:`
    bot.sendMessage(helper.getChatId(msg), text, {
        reply_markup: {
            keyboard: keyboard.home
        }
    })
})