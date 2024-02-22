const { network } = require("hardhat")
const {
    devChains,
    MOCK_EXCHANGE_RATE_ANSWER,
    MOCK_EXCHANGE_DECIMALS_ANSWER,
} = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (devChains.includes(network.name)) {
        log("-----------------------")
        log("Deploying mocks to local chain...")
        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [MOCK_EXCHANGE_DECIMALS_ANSWER, MOCK_EXCHANGE_RATE_ANSWER],
        })
        log("Mocks deployed")
        log("-----------------------")
    }
}

module.exports.tags = ["all", "mocks"]
