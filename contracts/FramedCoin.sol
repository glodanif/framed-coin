// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error FramedCoin__NotEnoughPayment(
    uint256 minimumValueToMint,
    uint256 mintingFee,
    uint256 minimumPayment,
    uint256 receivedValue
);
error FramedCoin__Unauthorized();
error FramedCoin__NotSupported();
error FramedCoin__NotFound();
error FramedCoin__UnauthorizedNftAccess();
error FramedCoin__WithdrawFailed();
error FramedCoin__NftAlreadyCashedOut();
error FramedCoin__NftStillHoldsTokens(uint256 value);

contract FramedCoin is ERC721, ERC721Enumerable, ReentrancyGuard, Pausable {
    event NftMinted(uint256 indexed tokenId, uint256 indexed value);
    event NftCashedOut(uint256 indexed tokenId, uint256 indexed value);
    event NftBurnt(uint256 indexed tokenId);
    event FeesWithdrawn(uint256 indexed value);

    uint256 private constant DECIMALS = 1000000000000000000;

    struct MetaData {
        uint256 value;
        uint256 boughtFor;
        uint256 boughtAt;
        uint256 soldFor;
        uint256 soldAt;
    }

    uint256 private s_unwithdrawnFees = 0;
    uint256 private s_tokenCounter = 0;
    uint256 private s_mintingFee;
    uint256 private s_minimumValueToMint;

    mapping(uint256 => MetaData) private s_tokenIdToMetaData;

    AggregatorV3Interface private i_exchangeRateFeed;
    address private immutable i_owner;

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert FramedCoin__Unauthorized();
        _;
    }

    constructor(
        uint256 mintingFee,
        uint256 minimumValueToMint,
        address exchangeRateFeedAddress
    ) ERC721("FraimedCoin", "FRC") {
        s_mintingFee = mintingFee;
        s_minimumValueToMint = minimumValueToMint;
        i_owner = msg.sender;
        i_exchangeRateFeed = AggregatorV3Interface(exchangeRateFeedAddress);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function pause() public onlyOwner nonReentrant {
        _pause();
    }

    function unpause() public onlyOwner nonReentrant {
        _unpause();
    }

    receive() external payable {
        revert FramedCoin__NotSupported();
    }

    fallback() external payable {
        revert FramedCoin__NotSupported();
    }

    function mintNft() public payable nonReentrant whenNotPaused returns (uint256) {
        uint256 mintingFee = s_mintingFee;
        uint256 minimumValueToMint = s_minimumValueToMint;
        uint256 minimalPayment = mintingFee + minimumValueToMint;
        if (msg.value < minimalPayment) {
            revert FramedCoin__NotEnoughPayment(
                minimumValueToMint,
                mintingFee,
                minimalPayment,
                msg.value
            );
        }
        uint256 tokenId = ++s_tokenCounter;
        s_unwithdrawnFees += mintingFee;
        uint256 value = msg.value - mintingFee;
        uint256 boughtFor = (getExchangeRate() * value) / DECIMALS;
        s_tokenIdToMetaData[tokenId] = MetaData(value, boughtFor, block.timestamp, 0x0, 0x0);
        _safeMint(msg.sender, tokenId);
        emit NftMinted(tokenId, value);
        return tokenId;
    }

    function cashOutNft(uint256 tokenId) public nonReentrant {
        if (ownerOf(tokenId) != msg.sender) {
            revert FramedCoin__UnauthorizedNftAccess();
        }
        MetaData storage metaData = s_tokenIdToMetaData[tokenId];
        if (metaData.soldAt != 0) {
            revert FramedCoin__NftAlreadyCashedOut();
        }
        metaData.soldFor = (getExchangeRate() * metaData.value) / DECIMALS;
        metaData.soldAt = block.timestamp;
        (bool isSuccessful, ) = payable(msg.sender).call{value: metaData.value}("");
        if (!isSuccessful) {
            revert FramedCoin__WithdrawFailed();
        }
        emit NftCashedOut(tokenId, metaData.value);
    }

    function burnNft(uint256 tokenId) public nonReentrant {
        mapping(uint256 => MetaData) storage tokenIdToMetaData = s_tokenIdToMetaData;
        if (ownerOf(tokenId) != msg.sender) {
            revert FramedCoin__UnauthorizedNftAccess();
        }
        MetaData storage metaData = tokenIdToMetaData[tokenId];
        if (metaData.soldAt == 0) {
            revert FramedCoin__NftStillHoldsTokens(metaData.value);
        }
        delete tokenIdToMetaData[tokenId];
        _burn(tokenId);
        emit NftBurnt(tokenId);
    }

    function withdrawFees() public onlyOwner nonReentrant {
        uint256 fees = s_unwithdrawnFees;
        s_unwithdrawnFees = 0;
        (bool isSuccessful, ) = payable(msg.sender).call{value: fees}("");
        if (!isSuccessful) {
            revert FramedCoin__WithdrawFailed();
        }
        emit FeesWithdrawn(fees);
    }

    function getExchangeRate() public view returns (uint256) {
        (, int answer, , , ) = i_exchangeRateFeed.latestRoundData();
        return uint256(answer * 10000000000);
    }

    function getMetaDataByTokenId(uint tokenId) public view returns (MetaData memory) {
        MetaData memory metaData = s_tokenIdToMetaData[tokenId];
        if (metaData.value == 0) {
            revert FramedCoin__NotFound();
        }
        return metaData;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }

    function getUnwithdrawnFees() public view onlyOwner returns (uint256) {
        return s_unwithdrawnFees;
    }

    function getMintingFee() public view returns (uint256) {
        return s_mintingFee;
    }

    function setMintingFee(uint256 mintingFee) public onlyOwner nonReentrant {
        s_mintingFee = mintingFee;
    }

    function getMinimumValueToMint() public view returns (uint256) {
        return s_minimumValueToMint;
    }

    function setMinimumValueToMint(uint256 minimumValueToMint) public onlyOwner nonReentrant {
        s_minimumValueToMint = minimumValueToMint;
    }

    function getMinimumPayment() public view returns (uint256) {
        return s_mintingFee + s_minimumValueToMint;
    }

    function getTotalNftsValue() public view returns (uint256) {
        return address(this).balance - s_unwithdrawnFees;
    }

    function getTotalNftsValueUsd() public view returns (uint256) {
        return (getTotalNftsValue() * getExchangeRate()) / DECIMALS;
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getExchangeRateFeed() public view returns (AggregatorV3Interface) {
        return i_exchangeRateFeed;
    }
}
