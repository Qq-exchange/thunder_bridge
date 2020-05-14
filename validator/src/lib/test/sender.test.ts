import Web3 from 'web3'
import { expect } from 'chai'
import { createSandbox, stub } from 'sinon'
import { TransactionConfig, TransactionReceipt } from 'web3-core'
import { EXTRA_GAS_PERCENTAGE } from '../../utils/constants'

import { FakeCache } from "../storage"
import { FakeQueue } from '../queue'
import { FakeLocker } from '../locker'
import { Sender, SenderWeb3Impl, Validator } from '../sender'
import { TxInfo } from '../types'
import { toBN, toWei } from 'web3-utils'
import { addExtraGas } from '../../utils/utils'
import { BigNumber } from 'bignumber.js'

var sandbox = createSandbox()

describe("Test SenderWeb3Impl", () => {
  let validator: Validator = {
    address: '0x458b8adf2248709cf739149fe4bab0b20101c4a1',
    privateKey: '348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709'
  }

  it("send tx", async () => {
    let nonce = 10
    let gasLimit = new BigNumber(100)
    let amount = toBN('10')
    let txinfo: TxInfo = {
      gasEstimate: toBN(50),
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    let gasService = {
      getPrice: () => Promise.resolve(10)
    }

    let web3 = new Web3(null)
    let chainId = 100
    let sw = new SenderWeb3Impl("myid", chainId, validator, web3, gasService)
    let privateKey = '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709'

    let signTransaction = sandbox.stub().resolves({
      messageHash: '0x88cfbd7e51c7a40540b233cf68b62ad1df3e92462f1c6018d6d67eae0f3b08f5',
      v: '0x25',
      r: '0xc9cf86333bcb065d140032ecaab5d9281bde80f21b9687b3e94161de42d51895',
      s: '0x727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68',
      rawTransaction: ('0xf869808504e3b29200831e848094f0109fc8df283027b6285cc889f' +
        '5aa624eac1f55843b9aca008025a0c9cf86333bcb065d140032ecaab5d9281bde80f21b9687' +
        'b3e94161de42d51895a0727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68')
    })
    web3.eth.accounts.signTransaction = signTransaction

    let recepit = {
      blockHash: "0xdbb365914fd57cfc08657eed1a843a619d51651b233d3b45648ca5658e54f14f",
      blockNumber: 6527760,
      contractAddress: null,
      cumulativeGasUsed: 7643463,
      from: "0xacb3e9205229d212db914a92c77856b228b0a4e4",
      gasUsed: 21000,
      logs: [],
      logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      status: true,
      to: "0x458b8adf2248709cf739149fe4bab0b20101c4a1",
      transactionHash: "0xb909b8f4074f45f067125348eb1cf71a197149dc03a37446dacd4a925963ff47",
      transactionIndex: 70
    }
    let sendSignedTransaction = sandbox.stub().resolves(recepit)
    web3.eth.sendSignedTransaction = sendSignedTransaction

    let ret = await sw.sendTx(nonce, gasLimit, amount, txinfo)

    // Test signTransaction arguments
    let expectTxConfig: TransactionConfig = {
      nonce: nonce,
      chainId: chainId,
      to: txinfo.to,
      data: txinfo.data,
      value: toWei(amount),
      gas: gasLimit.toString(),
      gasPrice: gasService.getPrice().toString(),
    }
    expect(signTransaction.lastCall.args[0]).to.be.deep.equal(expectTxConfig)
    expect(signTransaction.lastCall.args[1]).to.be.deep.equal(privateKey)
    expect(ret).to.be.equal(recepit)
  })
})


describe("Test Sender", () => {
  let web3: Web3
  let sw: SenderWeb3Impl
  let cache: FakeCache
  let queue: FakeQueue
  let lock: FakeLocker
  let sender: Sender

  let validator: Validator = {
    address: '0x458b8adf2248709cf739149fe4bab0b20101c4a1',
    privateKey: '348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709'
  }

  beforeEach(() => {
    web3 = new Web3(null)
    sw = new SenderWeb3Impl("myid", 100, validator, web3, null)
    cache = new FakeCache()
    queue = new FakeQueue()
    lock = new FakeLocker()
    sender = new Sender("myid", queue, sw, lock, 3, cache)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('Test nonce', async () => {
    web3.eth.getTransactionCount = sandbox.stub().resolves(20)
    // Cache miss
    expect(await sender.readNonce(false)).to.be.equal(20)

    // Cache hit
    await cache.set(sender.nonceKey, "10")
    expect(await sender.readNonce(false)).to.be.equal(10)
    expect(await cache.get(sender.nonceKey)).to.be.equal("10")

    // Force update
    web3.eth.getTransactionCount = sandbox.stub().resolves(50)
    expect(await sender.readNonce(true)).to.be.equal(50)

    await sender.updateNonce(20)
    expect(await cache.get(sender.nonceKey)).to.be.equal("20")
  })

  it('Test sendTx success', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    let nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    let receipt: TransactionReceipt = {
      status: true,
      transactionHash: "my transaction hash",
      transactionIndex: 10,
      blockHash: 'my block hash',
      blockNumber: 100,
      from: 'thunder',
      to: 'core',
      cumulativeGasUsed: 50,
      gasUsed: 30,
      logs: [],
      logsBloom: 'my logs bloom'
    }
    let s = sandbox.stub().resolves(receipt)
    sw.sendTx = s

    let result = await sender.sendTx(txinfo)

    expect(s.lastCall.args[0]).to.be.equal(nonce)
    // Expect call args: gasEstimate = txinfo.gasEstimate * EXTRA_GAS_PERCENTAGE
    let expectedGas = addExtraGas(gasUnit, EXTRA_GAS_PERCENTAGE)
    expect(s.lastCall.args[1]).to.be.deep.equal(expectedGas)
    expect(s.lastCall.args[2]).to.be.deep.equal(toBN('0'))
    expect(s.lastCall.args[3]).to.be.deep.equal(txinfo)

    // Result success
    expect(result).eq("success")
    // Nonce++
    expect(await cache.get(sender.nonceKey)).eq("51")
  })

  it('Test sendTx with tx already imported', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    let nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    sw.sendTx = sandbox.stub().throws(Error("Transaction with the same hash was already imported"))

    let result = await sender.sendTx(txinfo)
    expect(result).eq("success")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })

  it('Test sendTx with low nonce', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    // chain nonce: 100 > cached nonce 50
    await cache.set(sender.nonceKey, "50")
    web3.eth.getTransactionCount = sandbox.stub().resolves(100)

    sw.sendTx = sandbox.stub().throws(Error("Transaction nonce is too low"))
    let result = await sender.sendTx(txinfo)

    // Result failed
    expect(result).eq("failed")
    // Nonce should be update by querying web3
    expect(await cache.get(sender.nonceKey)).eq("100")
  })

  it('Test sendTx with insufficient found', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTx = sandbox.stub().throws(Error("Insufficient funds"))
    let result = await sender.sendTx(txinfo)

    expect(result).eq("insufficientFunds")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })

  it('Test sendTx with block gas limit exceed', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTx = sandbox.stub().throws(Error("exceeds block gas limit"))
    let result = await sender.sendTx(txinfo)

    expect(result).eq("success")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })
})