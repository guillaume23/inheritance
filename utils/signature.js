
import { arrayify } from "@ethersproject/bytes";
import { getAddress } from "ethers";

import { solidityPackedKeccak256 } from "ethers";

export async function signMessage(signer, contractAddress, nonce, destination) {
  const normalizedContractAddress = getAddress(contractAddress);
  const normalizedDestination = getAddress(destination);
 
  const messageHash = solidityPackedKeccak256(
    ["address", "uint256", "address"],
    [normalizedContractAddress, nonce, normalizedDestination]
  );
  const signature = await signer.signMessage(arrayify(messageHash));
  return signature;
}