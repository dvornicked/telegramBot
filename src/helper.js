module.exports = {
    logStart() {
        console.log('Bot has been started...')
    },

    getChatId(msg) {
        return msg.chat.id
    }
}