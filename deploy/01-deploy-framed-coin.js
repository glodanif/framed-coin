const { network, ethers } = require("hardhat")
const { networkConfig, devChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let tokenUsdPriceFeedAddress
    if (devChains.includes(network.name)) {
        const ethUsdAggregator = await get("MockV3Aggregator")
        tokenUsdPriceFeedAddress = ethUsdAggregator.address
    } else {
        tokenUsdPriceFeedAddress = networkConfig[chainId]["tokenUsdPriceFeed"]
    }
    const mintingFee = networkConfig[chainId]["mintingFee"]
    const minimumValueToMint = networkConfig[chainId]["minimumValueToMint"]
    const args = [
        ethers.utils.parseEther(mintingFee),
        ethers.utils.parseEther(minimumValueToMint),
        tokenUsdPriceFeedAddress,
    ]
    const basicNft = await deploy("FramedCoin", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!devChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(basicNft.address, args)
    }
    log("-----------------------")
}

module.exports.tags = ["all", "nft"]
