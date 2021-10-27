process.env.NTBA_FIX_319 = 1
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
    const chatId = helper.getChatId(msg)

    switch (msg.text) {
        case kb.home.favourite:
            break
        case kb.home.films:
            bot.sendMessage(chatId, 'Choose genre:', {
                reply_markup: {keyboard: keyboard.films}
            })
            break
        case kb.home.cinemas:
            break
        case kb.back:
            bot.sendMessage(chatId, 'What do you want to see?', {
                reply_markup: {keyboard: keyboard.home}
            })
            break
    }
})

bot.onText(RegExp('\/start'), msg => {
    const text = `Hello, ${msg.from.first_name}\nChoose a command to get started:`
    bot.sendMessage(helper.getChatId(msg), text, {
        reply_markup: {
            keyboard: keyboard.home
        }
    })
})