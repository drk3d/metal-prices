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

// Gold API answers 429 when it gets many requests at once. Each run used to
// ask it 40 times (4 metals x 10 currencies) and one 429 failed the whole run.
// Now it is asked 4 times (each metal in USD) and the other currencies come
// from one ECB exchange-rate request.
const FX_URL = "https://api.frankfurter.dev/v1/latest";
const RETRY_WAITS_MS = [5000, 20000, 60000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, label)
{
    for (let attempt = 0; ; attempt++)
    {
        const response = await fetch(url);

        if (response.ok)
            return await response.json();

        const retryable = response.status === 429 || response.status >= 500;

        if (!retryable || attempt >= RETRY_WAITS_MS.length)
            throw new Error(`${label} ${response.status}`);

        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 120000)
            : RETRY_WAITS_MS[attempt];

        console.log(`${label} ${response.status}, retrying in ${wait / 1000}s`);
        await sleep(wait);
    }
}

async function fetchMetal(symbol)
{
    const data = await fetchJson(`${BASE_URL}/${symbol}/USD`, `${symbol}/USD`);

    if (!(Number(data?.price) > 0))
        throw new Error(`${symbol}/USD has no price`);

    return data;
}

async function fetchUsdRates()
{
    const others = CURRENCIES.filter((c) => c !== "USD").join(",");
    const data = await fetchJson(`${FX_URL}?base=USD&symbols=${others}`, "USD exchange rates");
    const rates = { USD: 1 };

    for (const currency of CURRENCIES.filter((c) => c !== "USD"))
    {
        const rate = Number(data?.rates?.[currency]);

        if (!(rate > 0))
            throw new Error(`No USD/${currency} exchange rate`);

        rates[currency] = rate;
    }

    return rates;
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

function processCurrency(currency, usdPrices, rates)
{
    console.log(`Processing ${currency}`);

    const result = {
        symbol: currencySymbol(currency)
    };

    for (const metal of METALS)
    {
        const gram =
            ounceToGram(usdPrices[metal.symbol] * rates[currency]);

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

    return result;
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

    const usdPrices = {};

    for (const metal of METALS)
    {
        const data = await fetchMetal(metal.symbol);

        usdPrices[metal.symbol] = Number(data.price);
        database.updated = data.updatedAt || database.updated;
    }

    const rates = await fetchUsdRates();

    for (const currency of CURRENCIES)
    {
        database.currencies[currency] =
            processCurrency(currency, usdPrices, rates);
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
async function saveHistory(database)
{
    const today =
        new Date().toISOString().substring(0, 10);

    const filename =
        `./data/history/${today}.json`;

    try
    {
        await fs.access(filename);

        console.log("History already exists for today.");
    }
    catch
    {
        await fs.writeFile(
            filename,
            JSON.stringify(database, null, 4)
        );

        console.log(`History saved: ${today}.json`);
    }
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
        
        await saveHistory(database);
        
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
