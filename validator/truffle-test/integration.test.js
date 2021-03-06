const { BRIDGE_MODE } = process.env

const path = require('path')

const config = require(path.join(__dirname, '../config'))
const utils = require('./utils')
const { expect } = require('chai')

const w3 = utils.newWeb3()

const deployed = require(path.join(__dirname, '../../data/deployed.json'))

let foreign, erc20
if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  const ForeignBridge = artifacts.require('ForeignBridgeWithNativeToken')
  erc20 = foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
} else {
  const ForeignBridge = artifacts.require('ForeignBridgeErcToErcV2')
  const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
  foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
  erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)
}

const makeTransfer = async (account) => {
    return await utils.makeTransfer(w3, erc20, account, foreign.options.address)
}

contract("Test complexity case", (accounts) => {

  const dummy = accounts[8]

  let chainOpW3 = null
  beforeEach(async () => {
    chainOpW3 = await utils.ChainOpWeb3(w3)
  })

  it('test fill nonce if resent task was skipped', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [receiptorQ1, receiptorQ2, receiptorQ3] = await utils.newQueues(3)
    const [receiptor1, receiptor2, receiptor3] = await utils.newReceiptors(w3, 3)
    const [senderQ1, senderQ2, senderQ3] = await utils.newQueues(3)

    const r1 = await s1.run(task, receiptorQ1.sendToQueue)
    expect(r1).to.eq('success')
    await chainOpW3.makeOneBlock(dummy)

    const r2 = await s2.run(task, receiptorQ2.sendToQueue)
    expect(r2).to.eq('success')
    const t3 = await s3.processEventTask(task)
    await chainOpW3.makeOneBlock(dummy)

    const snapshotId = await chainOpW3.snapshot()

    const r3 = await s3.sendTx(t3, receiptorQ3.sendToQueue)
    expect(r3).to.eq('success')
    // s3 will failed due to enough affirmation
    await chainOpW3.makeOneBlock(dummy, true)

    await chainOpW3.revert(snapshotId)

    await chainOpW3.futureBlock(config.HOME_BLOCK_CONFIRMATION)

    const rr1 = await receiptor1.run(receiptorQ1.queue.pop(), senderQ1.sendToQueue)
    const rr2 = await receiptor2.run(receiptorQ2.queue.pop(), senderQ2.sendToQueue)
    const rr3 = await receiptor3.run(receiptorQ3.queue.pop(), senderQ3.sendToQueue)

    expect(rr1).to.equal("success")
    expect(rr2).to.equal("success")
    expect(senderQ1.queue).to.have.length(0)
    expect(senderQ2.queue).to.have.length(0)
    expect(rr3).to.equal("null")
    expect(senderQ3.queue).to.have.length(1)

    const resentTask = senderQ3.queue.pop()
    const oldNonce = await s3.readNonce(true)
    expect(oldNonce).to.eq(resentTask.nonce)

    // Sender.run will send a transaction to self in order to fill nonce while retry-task.
    const result = await s3.run(resentTask, receiptorQ3.sendToQueue)
    await chainOpW3.makeOneBlock(dummy)

    // resent task will be skipped due to enough affirmation
    expect(result).to.be.eq('sendDummyTxToFillNonce')
    const newNonce = await s3.readNonce(true)

    // Make sure old nonce was filled
    expect(newNonce).to.gt(resentTask.nonce)
  })

  afterEach(async () => {
    await chainOpW3.minerStart()
  })
})
