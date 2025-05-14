
import hre from "hardhat";
import { expect } from "chai";
import { DECIMALS, MINTING_AMOUNT } from "./constant";
import { MyToken, TinyBank } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TinyBank", () => {
  let signers: HardhatEthersSigner[];
  let myTokenC: MyToken;
  let tinyBankC: TinyBank;
  let managers: HardhatEthersSigner[];
  const EXPECTED_MANAGER_COUNT = 3;
  beforeEach(async () => {
    signers = await hre.ethers.getSigners();
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);
    const manager0 = signers[0];
    const manager1 = signers[2];
    const manager2 = signers[4];
    
    
    managers=[manager0, manager1, manager2]
    tinyBankC = await hre.ethers.deployContract("TinyBank", [
      await myTokenC.getAddress(), managers.map((m) => m.address)
    ]);
    
    await myTokenC.setManager(tinyBankC.getAddress());
  });
  describe("Initialized state check", () => {
    it("should return totalStaked 0", async () => {
      expect(await tinyBankC.totalStaked()).equal(0);
    });
    it("should return staked 0 amount of signer0", async () => {
      const signer0 = signers[0];
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("Staking", async () => {
    it("should return staked amount", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(stakingAmount);
      expect(await tinyBankC.totalStaked()).equal(stakingAmount);
      expect(await myTokenC.balanceOf(tinyBankC)).equal(
        await tinyBankC.totalStaked()
      );
    });
  });
  describe("Withdraw", async () => {
    it("should return 0 staked after withdrawing total token", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      await tinyBankC.withdraw(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });
  describe("reward", () => {
    it("should reward 1MT every blocks", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);

      const BLOCKS = 5n;
      const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
      for (var i = 0; i < BLOCKS; i++) {
        await myTokenC.transfer(transferAmount, signer0.address);
      };

      await tinyBankC.withdraw(stakingAmount); //reward 보상 지급
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        hre.ethers.parseUnits((BLOCKS + MINTING_AMOUNT + 1n).toString())
      );
    });

    it("should revert when changing rewardPerBlock by hacker", async () => {
      const hacker = signers[3];
      const rewardToChange = hre.ethers.parseUnits("10000", DECIMALS);
      await expect(
        tinyBankC.connect(hacker).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("You are not authorized to manage this contract");
    });
    
  });
  
  describe("multi manager", async () => {
    // 'managers' 변수는 beforeEach에서 [signers[0], signers[2], signers[4]]로 설정됨.
    it("should revert confirm() if caller is not a manager", async () => {
        const nonManagerSigner = signers[1]; 
        await expect(tinyBankC.connect(nonManagerSigner).confirm())
            .to.be.revertedWith("You are not a manager");
    });

    it("should allow a registered manager to confirm", async () => {
        // managers[0]는 signers[0]
        await expect(tinyBankC.connect(managers[0]).confirm()).to.not.be.reverted;
        // MultiManagedAccess.sol의 managers 배열에서 managers[0]의 주소는 0번 인덱스에 저장됨.
    });

    it("should revert setRewardPerBlock() unless all managers confirmed", async () => {
      // managers[0] (signers[0]) 와 managers[1] (signers[2])만 confirm.
      // managers[2] (signers[4])는 confirm하지 않음. 총 3명 필요.
      await tinyBankC.connect(managers[0]).confirm();
      await tinyBankC.connect(managers[1]).confirm();
      
      const rewardToChange = hre.ethers.parseUnits("100", DECIMALS);
      await expect(tinyBankC.connect(managers[2]).setRewardPerBlock(rewardToChange))
        .to.be.revertedWith("Not all confirmed yet");
    });

    it("should change rewardPerBlock when all managers confirm", async () => {
      for (let i = 0; i < managers.length; i++) {
        await tinyBankC.connect(managers[i]).confirm();
      }
      const rewardToChange = hre.ethers.parseUnits("100", DECIMALS);
      // signers[0]는 owner이자 managers[0]
      await expect(tinyBankC.connect(signers[0]).setRewardPerBlock(rewardToChange)).to.not.be.reverted;
      // 성공적으로 변경되었는지 값 확인은 유지
      expect(await tinyBankC.rewardPerBlock()).to.equal(rewardToChange);
    });

    it("should require re-confirmation for subsequent setRewardPerBlock after a successful call", async () => {
      // 첫번째 성공적인 호출
      for (let i = 0; i < managers.length; i++) {
        await tinyBankC.connect(managers[i]).confirm();
      }
      const rewardToChange1 = hre.ethers.parseUnits("100", DECIMALS);
      await tinyBankC.connect(signers[0]).setRewardPerBlock(rewardToChange1); // 성공

      // Confirmations가 리셋되었으므로, 두번째 호출은 실패해야 함
      const rewardToChange2 = hre.ethers.parseUnits("200", DECIMALS);
      await expect(tinyBankC.connect(signers[0]).setRewardPerBlock(rewardToChange2))
        .to.be.revertedWith("Not all confirmed yet");
    });
  });
});