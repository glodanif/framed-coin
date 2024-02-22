const { assert, expect } = require("chai")
const {
    devChains,
    networkConfig,
    MOCK_EXCHANGE_RATE_ANSWER,
} = require("../../helper-hardhat-config")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")

!devChains.includes(network.name)
    ? describe.skip
    : describe("FramedCoin", () => {
          const chainId = network.config.chainId
          let framedCoin
          let deployer
          let mockV3Aggregator
          const insufficientValue = ethers.utils.parseEther("0.01")
          const sufficientValue1 = ethers.utils.parseEther("1.005")
          const sufficientValue2 = ethers.utils.parseEther("2.005")
          const boughtAt = 2223229885
          const soldAt = 2380996583
          const mockedRate = ethers.BigNumber.from(MOCK_EXCHANGE_RATE_ANSWER).mul(10000000000)
          const mintingFee = ethers.utils.parseEther(networkConfig[chainId]["mintingFee"])
          const minimumValueToMint = ethers.utils.parseEther(
              networkConfig[chainId]["minimumValueToMint"]
          )
          const minimumPayment = mintingFee.add(minimumValueToMint)

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              framedCoin = await ethers.getContract("FramedCoin")
              mockV3Aggregator = await ethers.getContract("MockV3Aggregator", deployer)
          })

          describe("constructor", () => {
              it("sets the aggregator address correctly", async () => {
                  const response = await framedCoin.getExchangeRateFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
              it("sets the owner address correctly", async () => {
                  const response = await framedCoin.getOwner()
                  assert.equal(response, deployer)
              })
              it("sets the minting fee correctly", async () => {
                  const response = await framedCoin.getMintingFee()
                  assert.equal(response.toString(), mintingFee.toString())
              })
              it("sets the minimum value to mint correctly", async () => {
                  const response = await framedCoin.getMinimumValueToMint()
                  assert.equal(response.toString(), minimumValueToMint.toString())
              })
              it("calculates the minimum payment correctly", async () => {
                  const response = await framedCoin.getMinimumPayment()
                  assert.equal(response.toString(), minimumPayment.toString())
              })
              it("starts with correct token counter", async () => {
                  const response = await framedCoin.getTokenCounter()
                  assert.equal(response.toString(), "0")
              })
              it("starts with correct unwithdrawn fees value", async () => {
                  const response = await framedCoin.getUnwithdrawnFees()
                  assert.equal(response.toString(), "0")
              })
          })

          describe("receive", () => {
              it("reverts in every case", async () => {
                  const account = (await ethers.getSigners())[1]
                  await expect(
                      account.sendTransaction({
                          to: framedCoin.address,
                          value: ethers.utils.parseEther("1"),
                      })
                  ).to.be.revertedWith("FramedCoin__NotSupported")
              })
          })

          describe("fallback", () => {
              it("reverts in every case", async () => {
                  const account = (await ethers.getSigners())[1]
                  await expect(
                      account.sendTransaction({
                          to: framedCoin.address,
                          data: "0x1234567890",
                      })
                  ).to.be.revertedWith("FramedCoin__NotSupported")
              })
          })

          describe("setMintingFee", () => {
              it("is not accessable for not the owner", async () => {
                  const accounts = await ethers.getSigners()
                  const clientConnectedContract = await framedCoin.connect(accounts[1])
                  await expect(clientConnectedContract.setMintingFee("1")).to.be.revertedWith(
                      "FramedCoin__Unauthorized"
                  )
              })
              it("sets the minting fee correctly", async () => {
                  const initResponse = await framedCoin.getMintingFee()
                  const newFee = initResponse.add("1")
                  await framedCoin.setMintingFee(newFee)
                  const response = await framedCoin.getMintingFee()
                  assert.equal(response.toString(), newFee.toString())
              })
          })

          describe("setMinimumValueToMint", () => {
              it("is not accessable for not the owner", async () => {
                  const accounts = await ethers.getSigners()
                  const clientConnectedContract = await framedCoin.connect(accounts[1])
                  await expect(
                      clientConnectedContract.setMinimumValueToMint("1")
                  ).to.be.revertedWith("FramedCoin__Unauthorized")
              })
              it("sets the minimum value to mint correctly", async () => {
                  const initResponse = await framedCoin.getMinimumValueToMint()
                  const newMinValue = initResponse.add("1")
                  await framedCoin.setMinimumValueToMint(newMinValue)
                  const response = await framedCoin.getMinimumValueToMint()
                  assert.equal(response.toString(), newMinValue.toString())
              })
          })

          describe("getUnwithdrawnFees", () => {
            it("is not accessable for not the owner", async () => {
                const accounts = await ethers.getSigners()
                const clientConnectedContract = await framedCoin.connect(accounts[1])
                await expect(clientConnectedContract.getUnwithdrawnFees()).to.be.revertedWith(
                    "FramedCoin__Unauthorized"
                )
            })
        })

          describe("getExchangeRate", () => {
              it("fetches exchange rate correctly", async () => {
                  const response = await framedCoin.getExchangeRate()
                  assert.equal(response.toString(), mockedRate.toString())
              })
          })

          describe("mintNft", () => {
              let mintedTokenId
              beforeEach(async () => {
                  mintedTokenId = (await framedCoin.getTokenCounter()).add("1").toString()
              })
              it("reverts is sent not enought ETH", async () => {
                  await expect(framedCoin.mintNft({ value: insufficientValue }))
                      .to.be.revertedWith("FramedCoin__NotEnoughPayment")
                      .withArgs(minimumValueToMint, mintingFee, minimumPayment, insufficientValue)
              })
              it("increments token id", async () => {
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  const response = await framedCoin.getTokenCounter()
                  assert.equal(response.toString(), mintedTokenId)
              })
              it("adds minting fee correctly", async () => {
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  await framedCoin.mintNft({ value: sufficientValue2 })
                  const response = await framedCoin.getUnwithdrawnFees()
                  assert.equal(response.toString(), mintingFee.mul("2").toString())
              })
              it("succesfully mints NFT and assigns ownership", async () => {
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  const owner = await framedCoin.ownerOf(mintedTokenId)
                  assert.equal(owner, deployer)
              })
              it("emits minted event", async () => {
                  await expect(framedCoin.mintNft({ value: sufficientValue1 }))
                      .to.emit(framedCoin, "NftMinted")
                      .withArgs(mintedTokenId, sufficientValue1.sub(mintingFee).toString())
              })
              it("generates correct MetaData", async () => {
                  await network.provider.send("evm_setNextBlockTimestamp", [boughtAt])
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  const metaData = await framedCoin.getMetaDataByTokenId(mintedTokenId)
                  assert.equal(
                      metaData.value.toString(),
                      sufficientValue1.sub(mintingFee).toString()
                  )
                  assert.equal(
                      metaData.boughtFor.toString(),
                      sufficientValue1
                          .sub(mintingFee)
                          .mul(mockedRate)
                          .div("1000000000000000000")
                          .toString()
                  )
                  assert.equal(metaData.boughtAt.toString(), boughtAt.toString())
                  assert.equal(metaData.soldFor.toString(), "0")
                  assert.equal(metaData.soldAt.toString(), "0")
              })
              it("updates the contract balance", async () => {
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  await framedCoin.mintNft({ value: sufficientValue2 })
                  const endingBalance = await framedCoin.provider.getBalance(framedCoin.address)
                  const nftsValue = await framedCoin.getTotalNftsValue()
                  const nftsValueUsd = await framedCoin.getTotalNftsValueUsd()
                  const expectedNftsValue = sufficientValue1
                      .sub(mintingFee)
                      .add(sufficientValue2)
                      .sub(mintingFee)
                  assert.equal(
                      endingBalance.toString(),
                      sufficientValue1.add(sufficientValue2).toString()
                  )
                  assert.equal(nftsValue.toString(), expectedNftsValue.toString())
                  assert.equal(
                      nftsValueUsd.toString(),
                      expectedNftsValue.mul(mockedRate).div("1000000000000000000").toString()
                  )
              })
          })

          describe("withdrawFees", () => {
              beforeEach(async () => {
                  await framedCoin.mintNft({ value: sufficientValue1 })
                  await framedCoin.mintNft({ value: sufficientValue2 })
              })
              it("is not accessable for not the owner", async () => {
                  const accounts = await ethers.getSigners()
                  const clientConnectedContract = await framedCoin.connect(accounts[1])
                  await expect(clientConnectedContract.withdrawFees()).to.be.revertedWith(
                      "FramedCoin__Unauthorized"
                  )
              })
              it("resets unwithdrawn fees correctly", async () => {
                  await framedCoin.withdrawFees()
                  const unwithdrawnFees = await framedCoin.getUnwithdrawnFees()
                  assert.equal(unwithdrawnFees.toString(), "0")
              })
              it("emits withdrawn event", async () => {
                  const unwithdrawnFees = await framedCoin.getUnwithdrawnFees()
                  await expect(framedCoin.withdrawFees())
                      .to.emit(framedCoin, "FeesWithdrawn")
                      .withArgs(unwithdrawnFees)
              })
              it("recalculates total NFTs value and changes balance correctly", async () => {
                  const startingBalance = await framedCoin.provider.getBalance(framedCoin.address)
                  await framedCoin.withdrawFees()
                  const endingBalance = await framedCoin.provider.getBalance(framedCoin.address)
                  const totalNftsValue = await framedCoin.getTotalNftsValue()
                  assert.equal(totalNftsValue.toString(), endingBalance.toString())
                  assert.equal(
                      endingBalance.toString(),
                      sufficientValue1
                          .sub(mintingFee)
                          .add(sufficientValue2)
                          .sub(mintingFee)
                          .toString()
                  )
                  assert.equal(
                      startingBalance.sub(endingBalance).toString(),
                      mintingFee.mul("2").toString()
                  )
              })
              it("sends ETH to the owner account", async () => {
                  const startingBalance = await framedCoin.provider.getBalance(deployer)
                  const tx = await framedCoin.withdrawFees()
                  const rc = await tx.wait()
                  const { gasUsed, effectiveGasPrice } = rc
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const endingBalance = await framedCoin.provider.getBalance(deployer)
                  assert.equal(
                      endingBalance.toString(),
                      startingBalance.add(mintingFee.mul("2")).sub(gasCost).toString()
                  )
              })
          })

          describe("cashOutNft", () => {
              let client1ConnectedContract, client2ConnectedContract
              const nft1 = "1"
              const nonExistantNft = "101"
              let client1
              let client2
              beforeEach(async () => {
                  const signers = await ethers.getSigners()
                  client1 = signers[1]
                  client2 = signers[2]
                  client1ConnectedContract = await framedCoin.connect(client1)
                  await client1ConnectedContract.mintNft({ value: sufficientValue1 })
                  client2ConnectedContract = await framedCoin.connect(client2)
              })
              it("is not accessable for not the NFT owner", async () => {
                  await expect(client2ConnectedContract.cashOutNft(nft1)).to.be.revertedWith(
                      "FramedCoin__UnauthorizedNftAccess"
                  )
              })
              it("reverts when NFT does not exist", async () => {
                  await expect(
                      client1ConnectedContract.cashOutNft(nonExistantNft)
                  ).to.be.revertedWith("ERC721: invalid token ID")
              })
              it("reverts when NFT has been already cashed out", async () => {
                  client1ConnectedContract.cashOutNft(nft1)
                  await expect(client1ConnectedContract.cashOutNft(nft1)).to.be.revertedWith(
                      "FramedCoin__NftAlreadyCashedOut"
                  )
              })
              it("recalculates total NFTs value and changes balance correctly", async () => {
                  const metaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  const startingBalance = await framedCoin.provider.getBalance(framedCoin.address)
                  await client1ConnectedContract.cashOutNft(nft1)
                  const endingBalance = await framedCoin.provider.getBalance(framedCoin.address)
                  assert.equal(
                      endingBalance.toString(),
                      startingBalance.sub(metaData.value).toString()
                  )
              })
              it("updated MetaData correctly", async () => {
                  const initialMetaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  await network.provider.send("evm_setNextBlockTimestamp", [soldAt])
                  await client1ConnectedContract.cashOutNft(nft1)
                  const metaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  assert.equal(metaData.value.toString(), initialMetaData.value.toString())
                  assert.equal(metaData.boughtFor.toString(), initialMetaData.boughtFor.toString())
                  assert.equal(metaData.boughtAt.toString(), initialMetaData.boughtAt.toString())
                  assert.equal(
                      metaData.soldFor.toString(),
                      metaData.value.mul(mockedRate).div("1000000000000000000").toString()
                  )
                  assert.equal(metaData.soldAt.toString(), soldAt.toString())
              })
              it("emits cash out event", async () => {
                  const metaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  await expect(client1ConnectedContract.cashOutNft(nft1))
                      .to.emit(framedCoin, "NftCashedOut")
                      .withArgs(nft1, metaData.value)
              })
              it("sends ETH to the NFT owner account", async () => {
                  const metaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  const startingBalance = await framedCoin.provider.getBalance(client1.address)
                  const tx = await client1ConnectedContract.cashOutNft(nft1)
                  const rc = await tx.wait()
                  const { gasUsed, effectiveGasPrice } = rc
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const endingBalance = await framedCoin.provider.getBalance(client1.address)
                  assert.equal(
                      endingBalance.toString(),
                      startingBalance.add(metaData.value).sub(gasCost).toString()
                  )
              })
          })

          describe("burnNft", () => {
              let client1ConnectedContract, client2ConnectedContract
              const nft1 = "1"
              const nonExistantNft = "101"
              beforeEach(async () => {
                  const signers = await ethers.getSigners()
                  client1ConnectedContract = await framedCoin.connect(signers[1])
                  await client1ConnectedContract.mintNft({ value: sufficientValue1 })
                  client2ConnectedContract = await framedCoin.connect(signers[2])
              })
              it("is not accessable for not the NFT owner", async () => {
                  await expect(client2ConnectedContract.burnNft(nft1)).to.be.revertedWith(
                      "FramedCoin__UnauthorizedNftAccess"
                  )
              })
              it("reverts when NFT does not exist", async () => {
                  await expect(client1ConnectedContract.burnNft(nonExistantNft)).to.be.revertedWith(
                      "ERC721: invalid token ID"
                  )
              })
              it("reverts when NFT still holds ETH", async () => {
                  const metaData = await client1ConnectedContract.getMetaDataByTokenId(nft1)
                  await expect(client1ConnectedContract.burnNft(nft1))
                      .to.be.revertedWith("FramedCoin__NftStillHoldsTokens")
                      .withArgs(metaData.value)
              })
              it("reverts when NFT was already burnt", async () => {
                  await client1ConnectedContract.cashOutNft(nft1)
                  client1ConnectedContract.burnNft(nft1)
                  await expect(client1ConnectedContract.burnNft(nft1)).to.be.revertedWith(
                      "ERC721: invalid token ID"
                  )
              })
              it("removes MetaData for a token", async () => {
                  await client1ConnectedContract.cashOutNft(nft1)
                  await client1ConnectedContract.burnNft(nft1)
                  await expect(client1ConnectedContract.getMetaDataByTokenId(nft1)).to.be.revertedWith(
                    "FramedCoin__NotFound"
                )
              })
              it("emits burned event", async () => {
                  await client1ConnectedContract.cashOutNft(nft1)
                  await expect(client1ConnectedContract.burnNft(nft1))
                      .to.emit(framedCoin, "NftBurnt")
                      .withArgs(nft1)
              })
          })

          describe("pause", () => {
            let client1ConnectedContract
            beforeEach(async () => {
                const signers = await ethers.getSigners()
                client1ConnectedContract = await framedCoin.connect(signers[1])
            })
            it("blocks access to minting process", async () => {
                await framedCoin.pause()
                await expect(
                    client1ConnectedContract.mintNft({ value: sufficientValue1 })
                ).to.be.revertedWith("Pausable: paused")
            })
            it("is not accessable for not the NFT owner", async () => {
                await expect(
                    client1ConnectedContract.pause()
                ).to.be.revertedWith("FramedCoin__Unauthorized")
            })
        })

        describe("unpause", () => {
            let client1ConnectedContract
            let mintedTokenId
            beforeEach(async () => {
                const signers = await ethers.getSigners()
                client1ConnectedContract = await framedCoin.connect(signers[1])
                mintedTokenId = (await framedCoin.getTokenCounter()).add("1").toString()
            })
            it("restores access to minting process", async () => {
                await framedCoin.pause()
                await expect(
                    client1ConnectedContract.mintNft({ value: sufficientValue1 })
                ).to.be.revertedWith("Pausable: paused")
                await framedCoin.unpause()
                await expect(framedCoin.mintNft({ value: sufficientValue1 }))
                    .to.emit(framedCoin, "NftMinted")
                    .withArgs(mintedTokenId, sufficientValue1.sub(mintingFee).toString())
            })
            it("is not accessable for not the NFT owner", async () => {
                await expect(
                    client1ConnectedContract.unpause()
                ).to.be.revertedWith("FramedCoin__Unauthorized")
            })
        })
    })
