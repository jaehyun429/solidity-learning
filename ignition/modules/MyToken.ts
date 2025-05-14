import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MyTokenDeploy", (m) => {
  const MyTokenC = m.contract("MyToken", ["MyToken", "MT", 18]);
  return { MyTokenC };
});