const Redis = require('ioredis')
const JSONbig = require('json-bigint')
const logger = require('pino')()

const prefix = 'monitor'
const lastProcessedBlockKey = 'lastProcessedBlock'
const gasPriceKey = 'poa.gasPrice'
const thunderGasPriceKey = 'thunder.GasPrice'

Redis.prototype.getProcessedResult = async function (token, name) {
  const key = `${prefix}-cache-${token}-${name}`
  const obj = await this.get(key)
  logger.debug(`${token} getLastProcessedResult: ${name}`, obj)
  return JSONbig.parse(obj)
}

Redis.prototype.storeProcessedResult = async function (token, name, obj) {
  const key = `${prefix}-cache-${token}-${name}`
  const convertedObj = {
    value: obj.value.toString(),
    length: obj.length,
    users: Array.from(obj.users)
  }
  await this.set(key, JSON.stringify(convertedObj))
}

Redis.prototype.storeProcessedBlock = async function (token, home, foreign) {
  await Promise.all([
    this.set(`${token}-${lastProcessedBlockKey}-home`, home),
    this.set(`${token}-${lastProcessedBlockKey}-foreign`, foreign)
  ])
}

Redis.prototype.getProcessedBlock = async function (token) {
  const home = await this.get(`${token}-${lastProcessedBlockKey}-home`)
  const foreign = await this.get(`${token}-${lastProcessedBlockKey}-foreign`)
  return [home, foreign]
}

Redis.prototype.updateGasPrice = async function (gasPriceJson) {
  await this.set(gasPriceKey, JSON.stringify(gasPriceJson))
}

Redis.prototype.setGasPrice = async function (network, gasPrice) {
  await this.set(`${network}_${thunderGasPriceKey}`, gasPrice)
}

Redis.prototype.getGasPrice = async function (network) {
  const lastGasPrice = JSON.parse(await this.get(gasPriceKey))
  const thunderGasPrice = await this.get(`${network}_${thunderGasPriceKey}`)
  if (thunderGasPrice && Number(thunderGasPrice) > 0) {
    lastGasPrice['fixed'] = Number(thunderGasPrice)
  }
  return lastGasPrice
}

function newRedis(url) {
  const redis = new Redis(url)
  redis.on('connect', () => {
    logger.info(`Connected to redis ${url}`)
  })

  redis.on('error', () => {
    logger.info('Disconnected from redis')
  })
  return redis
}

module.exports = {
  newRedis,
}
