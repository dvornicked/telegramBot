process.env.NTBA_FIX_319 = 1
const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const config = require('./config')
const helper = require('./helper')
const keyboard = require('./keyboard')
const kb = require('./keyboard-buttons')
const database = require('../database.json')

const bot = new TelegramBot(config.TOKEN, {
    polling: true
})

helper.logStart()

mongoose.connect(config.DB_URL)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err))

require('./models/film.model')

const Film = mongoose.model('films')
// database.films.forEach(f => new Film(f).save())

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
        case kb.film.comedy:
            sendFilmsByQuery(chatId, {type: 'comedy'})
            break
        case kb.film.action:
            sendFilmsByQuery(chatId, {type: 'action'})
            break
        case kb.film.random:
            sendFilmsByQuery(chatId)
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

bot.onText(RegExp('\/f(.+)'), (msg, [source, match]) => {
    const filmUuid = helper.getItemUuid(source)
    const chatId = helper.getChatId(msg)

    Film.findOne({uuid: filmUuid}).then(film => {

        const caption = `Name: ${film.name}\nYear: ${film.year}\nRate: ${film.rate}\nLength: ${film.length}\nCountry: ${film.country}`

        bot.sendPhoto(chatId, film.picture, {
            caption,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Add to favourite',
                            callback_data: film.uuid
                        },
                        {
                            text: 'Show the cinemas',
                            callback_data: film.uuid
                        }
                    ],
                    [
                        {
                            text: 'Kinopoisk',
                            url: film.link
                        }
                    ]
                ]
            }
        })
    })
})

function sendFilmsByQuery(chatId, query) {
    Film.find(query).then(films => {

        const html = films.map((f, i) => {
            return `<b>${i + 1}</b> ${f.name} - /f${f.uuid}`
        }).join('\n')

        sendHTML(chatId, html, 'films')
    })
}

function sendHTML(chatId, html, kbName = null) {
    const options = {
        parse_mode: 'HTML'
    }
    if (kbName) {
        options['reply_markup'] = {
            keyboard: keyboard[kbName]
        }
    }

    bot.sendMessage(chatId, html, options)
}