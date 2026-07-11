import fetch from "node-fetch";
import fs from "fs/promises";

//======================================================
// CONFIGURATION
//======================================================

const API_KEY = process.env.GOLD_API_KEY;

const BASE_URL = "https://api.gold-api.com/price";

const TROY_OUNCE = 31.1034768;

// Supported currencies
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

// Metals we want
const METALS = [
    {
        name: "Gold",
        symbol: "XAU"
    },
    {
        name: "Silver",
        symbol: "XAG"
    },
    {
        name: "Platinum",
        symbol: "XPT"
    },
    {
        name: "Palladium",
        symbol: "XPD"
    }
];

//======================================================
// HELPER FUNCTIONS
//======================================================

function round(value)
{
    return Number(value.toFixed(2));
}

function ounceToGram(value)
{
    return value / TROY_OUNCE;
}

function calculateGold(price24)
{
    return {
        gold24: round(price24),
        gold22: round(price24 * 22 / 24),
        gold18Yellow: round(price24 * 18 / 24),
        gold18White: round(price24 * 18 / 24),
        gold14: round(price24 * 14 / 24),
        gold9: round(price24 * 9 / 24)
    };
}

function calculateSilver(price999)
{
    return {
        silver999: round(price999),
        silver925: round(price999 * 0.925)
    };
}

function calculatePlatinum(price999)
{
    return {
        platinum999: round(price999),
        platinum950: round(price999 * 0.95)
    };
}

// We can refine this later if you want to represent
// a specific palladium jewellery alloy.
function calculatePalladium(price999)
{
    return {
        palladium999: round(price999),
        palladium950: round(price999 * 0.95)
    };
}
function getCurrencySymbol(currency)
{
    switch(currency)
    {
        case "USD": return "$";
        case "EUR": return "€";
        case "GBP": return "£";
        case "CHF": return "CHF";
        case "JPY": return "¥";
        case "CNY": return "¥";
        case "HKD": return "HK$";
        case "SGD": return "S$";
        case "AUD": return "A$";
        case "CAD": return "C$";
        default: return currency;
    }
}
//======================================================
// DOWNLOAD ONE METAL
//======================================================

async function downloadMetal(symbol, currency)
{
    const url = `${BASE_URL}/${symbol}/${currency}`;

    console.log(`Downloading ${symbol} ${currency}`);

    const response = await fetch(url, {
        headers: {
            "x-access-token": API_KEY
        }
    });

    if (!response.ok)
    {
        throw new Error(
            `${symbol} ${currency} (${response.status})`
        );
    }

    return await response.json();
}

//======================================================
// DOWNLOAD ALL METALS FOR ONE CURRENCY
//======================================================

async function downloadCurrency(currency)
{
    console.log("");
    console.log("==============================");
    console.log(currency);
    console.log("==============================");

    const result = {};

    let updated = null;

    for (const metal of METALS)
    {
        const data = await downloadMetal(
            metal.symbol,
            currency
        );

        if (!updated)
            updated = data.updatedAt;

        const gramPrice =
            ounceToGram(data.price);

        switch (metal.symbol)
        {
            case "XAU":
                Object.assign(
                    result,
                    calculateGold(gramPrice)
                );
                break;

            case "XAG":
                Object.assign(
                    result,
                    calculateSilver(gramPrice)
                );
                break;

            case "XPT":
                Object.assign(
                    result,
                    calculatePlatinum(gramPrice)
                );
                break;

            case "XPD":
                Object.assign(
                    result,
                    calculatePalladium(gramPrice)
                );
                break;
        }
    }

    return {
        updated,
        prices: result
    };
}
//======================================================
// DOWNLOAD ALL CURRENCIES
//======================================================

async function downloadAllCurrencies()
{
    const currencies = {};

    let updated = null;

    for (const currency of CURRENCIES)
    {
        const data =
            await downloadCurrency(currency);

        currencies[currency] =
        {
            symbol:
                getCurrencySymbol(currency),

            metals:
                data.prices
        };

        if (!updated)
            updated = data.updated;
    }

    return {
        updated,
        currencies
    };
}

//======================================================
// CREATE FINAL JSON
//======================================================

function buildJson(download)
{
    return {

        provider: "Gold API",

        generatedAt:
            new Date().toISOString(),

        updated:
            download.updated,

        currencies:
            download.currencies

    };
}

//======================================================
// SAVE FILE
//======================================================

async function saveJson(data)
{
    await fs.writeFile(

        "./data/metals.json",

        JSON.stringify(
            data,
            null,
            4
        )

    );

    console.log("");
    console.log("metals.json written.");
}
//======================================================
// MAIN
//======================================================

async function main()
{
    try
    {
        console.log("");
        console.log("==============================");
        console.log("Starting Metal Update");
        console.log("==============================");

        const download =
            await downloadAllCurrencies();

        const json =
            buildJson(download);

        await saveJson(json);

        console.log("");
        console.log("Finished successfully.");
    }
    catch(ex)
    {
        console.error("");
        console.error("Updater failed");
        console.error(ex);

        process.exit(1);
    }
}

main();
