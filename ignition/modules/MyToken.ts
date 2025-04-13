import { buildModule } from "@nomicfoundation/ignition-core";
export default buildModule("MyTokenDeploy", (m) => {

    const myTokenC = m.contract("MyToken", ["MyToken", "MT", 18]);
    return { myTokenC };
});