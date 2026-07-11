import fetch from "node-fetch";

async function main() {

    try
    {
        const response = await fetch(
            "https://api.gold-api.com/price/XAU/USD"
        );

        console.log(response.status);

        const text = await response.text();

        console.log(text);

    }
    catch(ex)
    {
        console.error(ex);
    }

}

main();
