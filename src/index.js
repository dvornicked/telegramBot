process.env.NTBA_FIX_319 = 1
const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const geolib = require('geolib')
const _ = require('lodash')
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
require('./models/cinema.model')
require('./models/user.model')

const Film = mongoose.model('films')
const Cinema = mongoose.model('cinemas')
const User = mongoose.model('users')
// database.films.forEach(f => new Film(f).save())
// database.cinemas.forEach(c => new Cinema(c).save())

const ACTION_TYPE = {
    TOGGLE_FAV_FILM: 'tff',
    SHOW_CINEMAS: 'sc',
    SHOW_CINEMAS_MAP: 'scm',
    SHOW_FILMS: 'sf'
}

bot.on('message', msg => {
    console.log('Working')
    const chatId = helper.getChatId(msg)

    switch (msg.text) {
        case kb.home.favourite:
            showFavouriteFilms(chatId, msg.from.id)
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
            bot.sendMessage(chatId, 'Send location', {
                reply_markup: {
                    keyboard: keyboard.cinemas
                }
            })
            break
        case kb.back:
            bot.sendMessage(chatId, 'What do you want to see?', {
                reply_markup: {keyboard: keyboard.home}
            })
            break
    }
    if (msg.location) {
        getCinemasInCoords(chatId, msg.location)
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
    Promise.all([    User.findOne({telegramId: msg.from.id}), Film.findOne({uuid: filmUuid})])
        .then(([user, film]) => {
            let isFav = false

            if (user) {
                isFav = user.films.indexOf(film.uuid) !== -1
            }

            const favText = isFav ? 'Remove from favourite' : 'Add to favourite'

            const caption = `Name: ${film.name}\nYear: ${film.year}\nRate: ${film.rate}\nLength: ${film.length}\nCountry: ${film.country}`

            bot.sendPhoto(chatId, film.picture, {
                caption,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: favText,
                                callback_data: JSON.stringify({
                                    type: ACTION_TYPE.TOGGLE_FAV_FILM,
                                    filmUuid: film.uuid,
                                    isFav: isFav
                                })
                            },
                            {
                                text: 'Show the cinemas',
                                callback_data: JSON.stringify({
                                    type: ACTION_TYPE.SHOW_CINEMAS,
                                    cinemaUuids: film.cinemas
                                })
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

bot.onText(RegExp('\/c(.+)'), (msg, [source, match]) => {
    const cinemaUuid = helper.getItemUuid(source)
    const chatId = helper.getChatId(msg)

    Cinema.findOne({uuid: cinemaUuid}).then(cinema => {
        bot.sendMessage(chatId, `Cinema ${cinema.name}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: cinema.name,
                            url: cinema.url
                        },
                        {
                            text: `Show on the map`,
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS_MAP,
                                lat: cinema.location.latitude,
                                lon: cinema.location.longitude
                            })
                        }
                    ],
                    [
                        {
                            text: 'Show films',
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_FILMS,
                                filmUuids: cinema.films
                            })
                        }
                    ]
                ]
            }
        })
    })
})

bot.on('callback_query', query => {
    const userId = query.from.id
    let data

    try {
         data = JSON.parse(query.data)
    } catch (e) {
         throw new Error('Data is not an object')
    }

    const { type } = data

    if (type === ACTION_TYPE.SHOW_CINEMAS_MAP) {
        const {lat, lon} = data
        bot.sendLocation(query.message.chat.id, lat, lon)
    } else if (type === ACTION_TYPE.SHOW_FILMS) {
        sendFilmsByQuery(userId, {uuid: {'$in': data.filmUuids}})
    } else if (type === ACTION_TYPE.SHOW_CINEMAS) {
        sendCinemasByQuery(userId, {uuid: {'$in': data.cinemaUuids}})
    } else if (type === ACTION_TYPE.TOGGLE_FAV_FILM) {
        toggleFavouriteFilm(userId, query.id, data)
    }
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

function getCinemasInCoords(chatId, location) {
    Cinema.find({}).then(cinemas => {

        cinemas.forEach(c => {
            c.distance = geolib.getDistance(location, c.location) / 1000
        })

        cinemas = _.sortBy(cinemas, 'distance')
        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name}. <em>Distance</em> - <strong>${c.distance}</strong> km. /c${c.uuid}`
        }).join('\n')
        sendHTML(chatId, html, 'home')
    })
}

function toggleFavouriteFilm(userId, queryId, {filmUuid, isFav}) {

    let userPromise

    User.findOne({telegramId: userId}).then(user => {
        if (user) {
            if (isFav) {
                user.films = user.films.filter(fUuid => fUuid !== filmUuid)
            } else {
                user.films.push(filmUuid)
            }
            userPromise = user
        } else {
            userPromise = new User({
                telegramId: userId,
                films: [filmUuid]
            })
        }

        const answerText = isFav ? 'Deleted' : 'Added'

        userPromise.save().then(_ => {
            bot.answerCallbackQuery({
                callback_query_id: queryId,
                text: answerText
            })
        })
    })
}

function showFavouriteFilms(chatId, telegramId) {
    User.findOne({telegramId})
        .then(user => {
            if (user) {
                Film.find({uuid: {'$in': user.films}}).then(films => {
                    let html

                    if (films.length) {
                        html = films.map((f, i) => {
                            return `<b>${i + 1}</b> ${f.name} - <b>${f.rate}</b> (/f${f.uuid})`
                        }).join('\n')
                    } else {
                        html = `You haven\\'t added anything to your favorites yet.`
                    }
                    sendHTML(chatId, html, 'home')
                })
            } else {
                sendHTML(chatId, `You haven\\'t added anything to your favorites yet.`, 'home')
            }
        })
}

function sendCinemasByQuery(userId, query) {
    Cinema.find(query).then(cinemas => {
        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name} - /c${c.uuid}`
        }).join('\n')

        sendHTML(userId, html, 'home')
    })
}