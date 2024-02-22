const { ethers } = require("hardhat")

const networkConfig = {
    11155111: {
        name: "sepolia",
        tokenUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
        mintingFee: "0.005",
        minimumValueToMint: "0.01",
    },
    31337: {
        name: "hardhat",
        mintingFee: "0.005",
        minimumValueToMint: "0.01",
    },
    80001: {
        name: "mumbai",
        tokenUsdPriceFeed: "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
        mintingFee: "0.005",
        minimumValueToMint: "0.01",
    },
}

const devChains = ["hardhat", "localhost"]
const MOCK_EXCHANGE_DECIMALS_ANSWER = 8
const MOCK_EXCHANGE_RATE_ANSWER = 123400000000

module.exports = {
    networkConfig,
    devChains,
    MOCK_EXCHANGE_DECIMALS_ANSWER,
    MOCK_EXCHANGE_RATE_ANSWER,
}
