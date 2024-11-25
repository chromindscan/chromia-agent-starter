import { createClient } from "postchain-client";
import { createConnection } from "@chromia/ft4";

async function getChrPrice() {
    return fetch("https://api.coingecko.com/api/v3/simple/price?ids=chromaway&vs_currencies=usd").then(d=>d.json()).then(d => d.chromaway.usd)
}

async function checkBalance() {
    const client = await createClient({
        nodeUrlPool: ["https://system.chromaway.com:7740"],
        blockchainRid: "15C0CA99BEE60A3B23829968771C50E491BD00D2E3AE448580CD48A8D71E7BBA" // Economy Chain
    });

    console.log((await client.getLatestBlock()).height);
    const connection = await createConnection(client);
    const account = await connection.getAccountById("db328d94fad8b44cd9919d4be6cdc0a160d7341eb7b1573e2328b68a2dc14cb3");
    if (account) {
        const balances = await account.getBalances();
        const chrBalances = balances.data.find(b => b.asset.name === "Chromia" && b.asset.symbol === "CHR" && b.asset.id.toString("hex") === "5f16d1545a0881f971b164f1601cbbf51c29efd0633b2730da18c403c3b428b5");
        if (chrBalances?.amount) {
            const chrPrice = await getChrPrice();
            const value = Number(chrBalances.amount.value)
            const decimals = chrBalances.amount.decimals;
            const balance = value / 10 ** decimals;
            const usdValue = balance * chrPrice;
            console.log("Balances: ", balance);
            console.log("Price: ", chrPrice);
            console.log("Value: $", usdValue);

            if (usdValue > 90) {
                // Criteria to lease for a week
                console.log("Lease for a week");
            }
        }
    }
}

checkBalance();