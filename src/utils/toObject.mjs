export function toObject(msg) {
    if (!msg.content) {
        console.log('Message without content.')
        return
    }

    return JSON.parse(msg.content.toString())
}
