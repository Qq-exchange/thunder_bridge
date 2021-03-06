/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

// const infuraKey = "fj4jll3k.....";
//
const HDWalletProvider = require("@truffle/hdwallet-provider")

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */
  contracts_directory: "../contracts/contracts",
  migrations_directory: "../contracts/migrations",
  contracts_build_directory: "../contracts/build/contracts",

  networks: {
    develop: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    pala_single: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      provider: () => {
        const p = new HDWalletProvider("wisdom zero output drift choice bright east stuff craft inform invest patient", "http://127.0.0.1:7545")

        // stop polling block number in background, we don't need this in test
        p.engine.stop()
        return p
      },
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.4.24",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {           // see the solidity docs for advice about optimization and evmversion
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "byzantium"
      }
    }
  },
  plugins: [
    'truffle-contract-size'
  ]
}
