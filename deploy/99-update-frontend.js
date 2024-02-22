const fs = require("fs")
const { network } = require("hardhat")

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating frontend files...")
        await updateContractAddresses()
        await updateAbi()
        console.log("Frontend files updated")
        console.log("-----------------------")
    }
}

async function updateAbi() {
    const framedCoin = await ethers.getContract("FramedCoin")
    const body = `const abi = ${framedCoin.interface.format(ethers.utils.FormatTypes.json)}`
    fs.writeFileSync("out/abi.js", body)
}

async function updateContractAddresses() {
    const framedCoin = await ethers.getContract("FramedCoin")
    const contractAddresses = JSON.parse(fs.readFileSync("out/contracts.json", "utf8"))
    const chainId = network.config.chainId.toString()
    console.log("1 ===> ", chainId);
    console.log("2 ===> ", contractAddresses);
    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId].includes(framedCoin.address)) {
            contractAddresses[chainId].push(framedCoin.address)
        }
    } else {
        contractAddresses[chainId] = framedCoin.address
    }
    const json = JSON.stringify(contractAddresses)
    fs.writeFileSync("out/contracts.json", json)
    fs.writeFileSync("out/contracts.js", `const contracts = ${json}`)
}

module.exports.tags = ["all", "frontend"]
