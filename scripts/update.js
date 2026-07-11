import fetch from "node-fetch";
import fs from "fs/promises";

//======================================================
// CONFIGURATION
//======================================================

const BASE_URL = "https://api.gold-api.com/price";

const OUNCE_TO_GRAMS = 31.1034768;

const CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "CHF",
    "JPY",
    "CNY",
    "HKD",
    "SGD",
    "AUD",
    "CAD"
];

const METALS = [
    { symbol: "XAU", name: "Gold" },
    { symbol: "XAG", name: "Silver" },
    { symbol: "XPT", name: "Platinum" },
    { symbol: "XPD", name: "Palladium" }
];

//======================================================
// HELPERS
//======================================================

function round(v)
{
    return Number(v.toFixed(2));
}

function ounceToGram(price)
{
    return price / OUNCE_TO_GRAMS;
}

function currencySymbol(currency)
{
    const map = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        CHF: "CHF",
        JPY: "¥",
        CNY: "¥",
        HKD: "HK$",
        SGD: "S$",
        AUD: "A$",
        CAD: "C$"
    };

    return map[currency] || currency;
}

//======================================================
// API
//======================================================

async function fetchMetal(symbol, currency)
{
    const response = await fetch(
        `${BASE_URL}/${symbol}/${currency}`
    );

    if (!response.ok)
    {
        throw new Error(
            `${symbol}/${currency} ${response.status}`
        );
    }

    return await response.json();
}
//======================================================
// JEWELLERY CALCULATIONS
//======================================================

function calculateGold(price24)
{
    return {
        "24K": round(price24),
        "22K": round(price24 * 22 / 24),
        "21K": round(price24 * 21 / 24),
        "19.2K": round(price24 * 19.2 / 24),
        "18K Yellow": round(price24 * 18 / 24),
        "18K White": round(price24 * 18 / 24),
        "14K": round(price24 * 14 / 24),
        "10K": round(price24 * 10 / 24),
        "9K": round(price24 * 9 / 24)
    };
}

function calculateSilver(price999)
{
    return {
        "999": round(price999),
        "925": round(price999 * 0.925)
    };
}

function calculatePlatinum(price999)
{
    return {
        "999": round(price999),
        "950": round(price999 * 0.95)
    };
}

function calculatePalladium(price999)
{
    return {
        "999": round(price999),
        "950": round(price999 * 0.95)
    };
}

//======================================================
// PROCESS ONE CURRENCY
//======================================================

async function processCurrency(currency)
{
    console.log(`Processing ${currency}`);

    const result = {
        symbol: currencySymbol(currency)
    };

    let updated = "";

    for (const metal of METALS)
    {
        const data = await fetchMetal(
            metal.symbol,
            currency
        );

        updated = data.updatedAt;

        const gram =
            ounceToGram(data.price);

        switch (metal.symbol)
        {
            case "XAU":
                result.gold =
                    calculateGold(gram);
                break;

            case "XAG":
                result.silver =
                    calculateSilver(gram);
                break;

            case "XPT":
                result.platinum =
                    calculatePlatinum(gram);
                break;

            case "XPD":
                result.palladium =
                    calculatePalladium(gram);
                break;
        }
    }

    return {
        updated,
        data: result
    };
}
//======================================================
// BUILD JSON
//======================================================

async function buildDatabase()
{
    const database =
    {
        provider: "Gold API",

        generated:
            new Date().toISOString(),

        updated: "",

        currencies: {}
    };

    for (const currency of CURRENCIES)
    {
        const result =
            await processCurrency(currency);

        database.updated =
            result.updated;

        database.currencies[currency] =
            result.data;
    }

    return database;
}
//======================================================
// SAVE FILE
//======================================================

async function saveDatabase(database)
{
    await fs.writeFile(

        "./data/metals.json",

        JSON.stringify(
            database,
            null,
            4
        )

    );

    console.log("");
    console.log("metals.json saved");
}
//======================================================
// MAIN
//======================================================

async function main()
{
    try
    {
        console.log("");
        console.log("=========================");
        console.log("Updating Metal Prices");
        console.log("=========================");
        console.log("");

        const database =
            await buildDatabase();

        await saveDatabase(database);

        console.log("");
        console.log("Done.");

    }
    catch(ex)
    {
        console.error(ex);

        process.exit(1);
    }
}

main();
