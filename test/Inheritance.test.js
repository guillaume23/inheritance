// test/SuccessionManager.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signMessage } = require("../utils/signature");

describe("SuccessionManager Contract", function () {
  let contract, owner, heirs, other;
  const threshold = 2;
  const lockInTime = 60 * 60 * 24; // 1 day

  beforeEach(async function () {
    [owner, ...heirs] = await ethers.getSigners();
    other = heirs[3];

    const SuccessionManager = await ethers.getContractFactory(
      "SuccessionManager"
    );
    contract = await SuccessionManager.deploy(
      owner.address,
      heirs.slice(0, 3).map((a) => a.address),
      threshold,
      lockInTime
    );
  });

  describe("Deployment", function () {
    it("should deploy with correct heirs and threshold", async function () {
      expect(await contract.threshold()).to.equal(threshold);
      for (let i = 0; i < threshold + 1; i++) {
        expect(await contract.isHeir(heirs[i].address)).to.be.true;
      }
    });

    it("should not deploy with empty heirs", async function () {
      const SuccessionManager = await ethers.getContractFactory(
        "SuccessionManager"
      );
      await expect(
        SuccessionManager.deploy(
          owner.address,
          heirs.slice(0, 3).map((a) => a.address),
          4,
          lockInTime
        )
      ).to.be.revertedWith("Invalid threshold");
    });

    it("should not deploy with threshold greater than # hiers", async function () {
      const SuccessionManager = await ethers.getContractFactory(
        "SuccessionManager"
      );
      await expect(
        SuccessionManager.deploy(owner.address, [], threshold, lockInTime)
      ).to.be.revertedWith("Invalid threshold");
    });
  });

  describe("Funding", function () {
    it("should accept ETH", async function () {
      await owner.sendTransaction({
        to: contract.getAddress(),
        value: ethers.parseEther("1"),
      });
      expect(await ethers.provider.getBalance(contract.getAddress())).to.equal(
        ethers.parseEther("1")
      );
    });
  });

  describe("Arming", function () {
    it("should arm the contract with valid signatures", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      const tx = await contract.connect(owner).arm(signatures, destination);
      await expect(tx).to.emit(contract, "Armed");

      const state = await contract.isArmed();
      expect(state).to.be.true;
    });

    it("should arm with a single signer", async function () {
      const newThreshold = 1;
      await contract
        .connect(owner)
        .updateHeirs(
          [heirs[0].address, heirs[2].address],
          newThreshold,
          lockInTime
        );
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
      ]);

      const tx = await contract.connect(owner).arm(signatures, destination);
      await expect(tx).to.emit(contract, "Armed");

      const state = await contract.isArmed();
      expect(state).to.be.true;
    });

    it("should arm with all signer", async function () {
      const newThreshold = 3;
      await contract
        .connect(owner)
        .updateHeirs(
          [heirs[0].address, heirs[1].address, heirs[2].address],
          newThreshold,
          lockInTime
        );
      const destination = other.address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
        signMessage(heirs[2], contract.target, nonce, destination),
      ]);

      const tx = await contract.connect(owner).arm(signatures, destination);
      await expect(tx).to.emit(contract, "Armed");

      const state = await contract.isArmed();
      expect(state).to.be.true;
    });

    it("Fails if threshold not met (only 1 signature)", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
      ]);

      await expect(
        contract.connect(owner).arm(signatures, destination)
      ).to.be.revertedWith("Insufficient valid signatures");
    });

    it("Fails if any signer is not a recognized heir", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(other, contract.target, nonce, destination),
      ]);

      await expect(
        contract.connect(owner).arm(signatures, destination)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Fails if signatures do not match the message", async function () {
      const destination = heirs[2].address;
      const otherDestination = other.address;

      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      await expect(
        contract.connect(owner).arm(signatures, otherDestination)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Fails if duplicate signatures are used", async function () {
      const destination = heirs[2].address;
      const otherDestination = other.address;

      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[0], contract.target, nonce, destination),
      ]);

      await expect(
        contract.connect(owner).arm(signatures, destination)
      ).to.be.revertedWith("Duplicate signature");
    });
  });

  describe("Disarming", function () {
    it("should disarm the contract and increment nonce", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      const tx = await contract.connect(owner).arm(signatures, destination);
      await expect(tx).to.emit(contract, "Armed");

      await contract.connect(owner).cancel();
      expect(await contract.isArmed()).to.be.false;
      expect(await contract.nonce()).to.equal(1);
    });

    it("should fail if called by non-owner", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();

      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      const tx = await contract.connect(owner).arm(signatures, destination);
      await expect(tx).to.emit(contract, "Armed");

      await expect(contract.connect(other).cancel()).to.be.reverted;
    });
  });

  describe("Transfer", function () {
    it("should transfer funds after lockIn period and emit event", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      //make sure the contract has some ETH
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1"),
      });

      await contract.connect(owner).arm(signatures, destination);
      await ethers.provider.send("evm_increaseTime", [lockInTime + 1]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(destination);
      await expect(contract.connect(heirs[1]).triggerTransfer([])).to.emit(
        contract,
        "Transferred"
      );
      const balanceAfter = await ethers.provider.getBalance(destination);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should transfer funds after lockIn period and emit event from arm operator", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      //make sure the contract has some ETH
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1"),
      });

      await contract.connect(other).arm(signatures, destination);
      await ethers.provider.send("evm_increaseTime", [lockInTime + 1]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(destination);
      await expect(contract.connect(other).triggerTransfer([])).to.emit(
        contract,
        "Transferred"
      );
      const balanceAfter = await ethers.provider.getBalance(destination);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should transfer funds and ERC20 after armed", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      token = await ERC20Mock.deploy("TestToken", "TTK", owner.address, 1000);
      await token.waitForDeployment();

      //make sure the contract has some ETH
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1"),
      });

      //send token to contract
      await token.transfer(contract.target, 500);

      await contract.connect(other).arm(signatures, destination);
      await ethers.provider.send("evm_increaseTime", [lockInTime + 1]);
      await ethers.provider.send("evm_mine");

      const contractTokenBalance = await token.balanceOf(contract.target);
      expect(contractTokenBalance).to.equal(500);

      const balanceBefore = await ethers.provider.getBalance(destination);
      await expect(
        contract.connect(other).triggerTransfer([token.target])
      ).to.emit(contract, "Transferred");
      const balanceAfter = await ethers.provider.getBalance(destination);

      expect(balanceAfter).to.be.gt(balanceBefore);
      const tokenBalance = await token.balanceOf(destination);
      expect(tokenBalance).to.equal(500);
    });

    it("should fail transfer funds from unknown address", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      //make sure the contract has some ETH
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1"),
      });

      await contract.connect(owner).arm(signatures, destination);
      await ethers.provider.send("evm_increaseTime", [lockInTime + 1]);
      await ethers.provider.send("evm_mine");
      await expect(contract.connect(other).triggerTransfer([])).to.be.reverted;
    });

    it("should fail if lockIn period not passed", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      await contract.connect(owner).arm(signatures, destination);
      await expect(contract.connect(heirs[1]).triggerTransfer([])).to.be
        .reverted;
    });
  });

  /*
  describe("OwnerTransfer", function () {

       it("Allows owner to withdraw ETH (happy path)", async function () {
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1"),
      });

      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );
      const tx = await contract.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const contractBalance = await ethers.provider.getBalance(
        await contract.getAddress()
      );

      expect(contractBalance).to.equal(0n);
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance - gasUsed);
    });

    it("Fails when a non-owner tries to withdraw", async function () {
      await expect(contract.connect(other).withdraw())
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("should allow the owner to manually transfer ETH", async () => {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1.0"),
      });

      const initialBalance = await ethers.provider.getBalance(other.address);

      //Owner calls ownerTransfer
      const tx = await contract
        .connect(owner)
        .ownerTransfer(other.address, ethers.parseEther("0.5"));
      await tx.wait();

      const finalBalance = await ethers.provider.getBalance(other.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("0.5"));
    });

    it("should not allow heir to manually transfer ETH", async () => {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("1.0"),
      });

      // Try to call manualTransfer from a non-owner address
      await expect(
        contract
          .connect(other)
          .ownerTransfer(other.address, ethers.parseEther("0.5"))
      )
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });
  });
*/

  describe("Valid calls", function () {
    it("should transfer full ETH to address", async function () {
      const to = heirs[0].address;
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("10"),
      });

      const before = await ethers.provider.getBalance(to);

      await contract.transferAssets(to, 0, [], true);

      const after = await ethers.provider.getBalance(to);
      expect(after - before).to.be.closeTo(
        ethers.parseEther("10"),
        ethers.parseEther("0.001")
      );
    });

    it("should transfer partial ETH to address", async function () {
      const to = heirs[0].address;
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("10"),
      });
      await contract.transferAssets(to, ethers.parseEther("1"), [], false);

      const bal = await ethers.provider.getBalance(to);
      expect(bal).to.be.above(ethers.parseEther("0.9"));
    });

    it("should transfer tokens only", async function () {
      const to = heirs[0].address;

      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const token1 = await ERC20Mock.deploy(
        "TestToken",
        "TTK",
        contract.target,
        1000
      );

      await contract.transferAssets(to, 0, [token1.target], false);

      const bal = await token1.balanceOf(to);
      expect(bal).to.equal(ethers.parseUnits("1000", 0));
    });

    it("should transfer ETH and multiple tokens", async function () {
      const to = heirs[1].address;
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const token1 = await ERC20Mock.deploy(
        "TestToken",
        "TTK",
        contract.target,
        1000
      );
      const token2 = await ERC20Mock.deploy(
        "TestToken 2",
        "TGK",
        contract.target,
        2000
      );
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("10"),
      });

      await contract.transferAssets(
        to,
        ethers.parseEther("1"),
        [token1.target, token2.target],
        false
      );

      const bal1 = await token1.balanceOf(to);
      const bal2 = await token2.balanceOf(to);
      expect(bal1).to.equal(ethers.parseUnits("1000", 0));
      expect(bal2).to.equal(ethers.parseUnits("2000", 0));
    });
  });

  describe("Failures", function () {
    it("should revert if called by non-owner", async function () {
      await expect(
        contract
          .connect(heirs[0])
          .transferAssets(heirs[0].address, 0, [], false)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("should revert if destination address is zero", async function () {
      await expect(
        contract.transferAssets(ethers.ZeroAddress, 0, [], false)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("should revert if ethAmount > balance and transferAllEth = false", async function () {
      await owner.sendTransaction({
        to: contract.target,
        value: ethers.parseEther("10"),
      });
      const tooMuch = ethers.parseEther("9999");
      await expect(
        contract.transferAssets(heirs[0].address, tooMuch, [], false)
      ).to.be.revertedWith("Insufficient ETH");
    });
  });

  describe("Edge cases", function () {
    it("should silently skip tokens with zero balance", async function () {
      const to = heirs[0].address;
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const token1 = await ERC20Mock.deploy(
        "TestToken",
        "TTK",
        owner.address,
        1000
      );
      await contract.transferAssets(to, 0, [token1.target], false);

      const bal = await token1.balanceOf(to);
      expect(bal).to.equal(0);
    });

    it("should succeed with empty token list and no ETH", async function () {
      await contract.transferAssets(heirs[0].address, 0, [], false);
    });
  });

  describe("Security and Replay Protection", function () {
    it("should reject reused nonce", async function () {
      const destination = heirs[2].address;
      const nonce = await contract.nonce();
      const signatures = await Promise.all([
        signMessage(heirs[0], contract.target, nonce, destination),
        signMessage(heirs[1], contract.target, nonce, destination),
      ]);

      await contract.connect(owner).arm(signatures, destination);
      await contract.connect(owner).cancel();

      await expect(contract.connect(owner).arm(signatures, destination)).to.be
        .reverted;
    });

    it("should allow updating heirs and threshold by owner", async function () {
      const newThreshold = 1;
      await contract
        .connect(owner)
        .updateHeirs(
          [heirs[0].address, heirs[2].address],
          newThreshold,
          lockInTime
        );

      expect(await contract.threshold()).to.equal(newThreshold);
      expect(await contract.isHeir(heirs[0].address)).to.be.true;
      expect(await contract.isHeir(heirs[1].address)).to.be.false;
    });

    it("should not allow updating heirs when threshold is 0", async function () {
      const newThreshold = 0;
      await expect(
        contract
          .connect(owner)
          .updateHeirs(
            [heirs[0].address, heirs[2].address],
            newThreshold,
            lockInTime
          )
      ).to.be.revertedWith("Invalid threshold");
    });

    it("should not allow updating heirs when threshold is greater than heirs", async function () {
      const newThreshold = 3;
      await expect(
        contract
          .connect(owner)
          .updateHeirs(
            [heirs[0].address, heirs[2].address],
            newThreshold,
            lockInTime
          )
      ).to.be.revertedWith("Invalid threshold");
    });
  });
});
