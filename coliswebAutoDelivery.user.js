// ==UserScript==
// @name         Coliweb Livraison Calculator
// @namespace    cstrm.scripts/colisweb1
// @version      1.6
// @description  Fetch and log package specifications
// @author       Arnaud D.
// @match        https://prod-agent.castorama.fr/*
// @match        https://bo.production.colisweb.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @run-at       document-idle

// ==/UserScript==

// --------------------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------------

// SCRIPT 1 : Fonctions


// Define a global variable to store fetched product data
let fetchedProductData = [];

// Function to make a CORS-compliant request using GM_xmlhttpRequest
async function makeCORSRequest(url, method, headers, payload) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: method,
            url: url,
            headers: headers,
            data: payload,
            onload: function(response) {
                resolve(response.responseText);
            },
            onerror: function(error) {
                reject(error);
            }
        });
    });
}

// Function to extract EANs and quantities
function fetchEANsAndQuantities() {
    var eanElements = document.querySelectorAll('.js-ean-val');
    var productData = [];

    eanElements.forEach(function(eanElement) {
        var ean = eanElement.textContent.trim();
        var quantityElement = eanElement.closest('tr').querySelector('.js-basket-qty-change');
        var quantity = quantityElement ? quantityElement.value.trim() : '0';
        productData.push({ ean: ean, quantity: quantity });
    });

    return productData;
}

// Function to fetch the client's delivery or billing address
function fetchClientAddress() {
    var deliveryAddressSelector = '.js-saved-delivery-address .accord-content .panel-inner .cust-del-add-col1 dd address';
    var billingAddressSelector = '.accord-content .panel-inner .cust-del-add-col1 dd address';

    var deliveryAddressElement = document.querySelector(deliveryAddressSelector);
    var billingAddressElement = document.querySelector(billingAddressSelector);

    var address = '';
    if (deliveryAddressElement && deliveryAddressElement.textContent.trim() !== '') {
        address = deliveryAddressElement.textContent.trim();
    } else if (billingAddressElement) {
        address = billingAddressElement.textContent.trim();
    }

    // Cleaning and formatting the address
    address = address.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();

    var postalCodeMatch = address.match(/\b\d{5}\b/);
    var postalCode = postalCodeMatch ? postalCodeMatch[0] : null;

    console.log("Address:", address);
    console.log("Extracted Postal Code:", postalCode);

    // Return both address and postalCode
    return { address, postalCode };
}


// Function to fetch the client's contact info
function fetchClientInfos() {
    var nameSelector = 'document.querySelector("#tabs-customer-details > div > div.primary-col > div.js-account-details-response > div:nth-child(1) > div.accord-content > div.col1.cust-del-add-col1 > dl > dd:nth-child(2)"))'; // Replace with the name selector
    var phoneSelector = '#tabs-customer-details > div > div.primary-col > div.js-account-details-response > div.accord-wrapper.js-tpAccountContact > div.accord-content.panel-list > div:nth-child(1) > div.col2.cust-del-add-col2 > dls'; // Replace with the phone selector

    var nameElement = document.querySelector(nameSelector);
    var phoneElement = document.querySelector(phoneSelector);

    let name = '';
    let firstName = '';
    let phone = '';

    if (nameElement && nameElement.textContent.trim() !== '') {
        // Logic to split the name and extract the phone
        let fullName = nameElement.textContent.trim().replace(/^(Mr\.|Mme\.)\s*/, ''); // Remove title and trim
        let nameParts = fullName.split(' '); // Split by space to separate first name from last name(s)

        firstName = nameParts.shift(); // The first element is the first name
        name = nameParts.join(' '); // The rest is considered as the last name
    }

    if (phoneElement && phoneElement.textContent.trim() !== '') {
        let phoneText = phoneElement.textContent.trim();
        let matches = phoneText.match(/\d/g); // Extract all digits
        if (matches && matches.length >= 10) {
            phone = matches.join('').substring(0, 10); // Join and take the first 10 digits
        }
    }

    console.log("Name:", firstName, name);
    console.log("Phone: ", phone);

    return {firstName, name, phone};
}




async function fetchGeocodeData(address) {
    console.log("Fetching geocode data for address:", address);

    // Helper function to attempt fetching geocode data with a given address
    async function attemptGeocode(queryAddress) {
        const url = `https://geocode.maps.co/search?q=${encodeURIComponent(queryAddress)}&api_key=65ae97aa4417a328160769gcb8adb4f`;
        console.log("Requesting Geocode Data from URL:", url);
        try {
            const responseText = await makeCORSRequest(url, "GET", {}, null);
            const responseJson = JSON.parse(responseText);
            if (responseJson && responseJson.length > 0) {
                const latitude = responseJson[0].lat;
                const longitude = responseJson[0].lon;
                console.log("Latitude:", latitude, "Longitude:", longitude);
                return { latitude, longitude };
            }
        } catch (error) {
            console.error("Error fetching geocode data:", error);
        }
        return null;
    }

    // Initial attempt with full address
    let geoData = await attemptGeocode(address);
    if (geoData) return geoData;

    // Attempt without house number
    const addressWithoutHouseNumber = address.replace(/^\d+\s*/, '');
    console.log("Requesting Geocode Data from URL:",addressWithoutHouseNumber );
    await delay(1001);
    geoData = await attemptGeocode(addressWithoutHouseNumber);
    if (geoData) return geoData;

    // Modify regex to assume city follows the 5-digit postal code
    const cityRegex = /\b\d{5}\b\s*(.*)/;
    const match = address.match(cityRegex);
    if (match && match[1]) {
        // This captures everything after the postal code, assumed to be the city
        const city = match[1].trim();
        const postalCode = match[0].trim().substring(0, 5); // Extracts the postal code
         console.log("Requesting Geocode Data from URL:",`${city} ${postalCode}` );
        await delay(1001);
        geoData = await attemptGeocode(`${city} ${postalCode}`);
        if (geoData) return geoData;
    }

    // If all attempts fail, return null and optionally notify the user
    console.log("No geocode data found for the address after multiple attempts");
    notification("", "Problème avec l'adresse - géolocalisation impossible");
    return null;
}


// Déclaration de la variable du buton "programmer la livraison" pour le rendre accessible à onLivraisonButtonPress()
let deliveryButton;
// Utility function for creating and styling buttons
function createButton({ id, textContent, styles, onClick }) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = textContent;
    Object.assign(button.style, {
        zIndex: '1000',
        position: 'relative',
        backgroundClip: 'padding-box',
        backgroundColor: '#0078d7',
        borderRadius: '5px',
        border: '1px solid #005cca',
        color: '#fff',
        display: 'inline-block',
        padding: '7px 10px',
        height: '30px',
        textDecoration: 'none',
        width: 'auto',
        cursor: 'pointer',
        margin: '0',
        font: 'bold 1em / 1.25 Arial,Helvetica,sans-serif',
        whiteSpace: 'nowrap',
        ...styles
    });
    button.addEventListener('click', onClick);
    button.addEventListener("mouseover", function() {
        this.style.backgroundColor = "#005CE6";
        this.classList.add("hover-style");
    });

    button.addEventListener("mouseout", function() {
        this.style.backgroundColor = "#0078d7";
        this.classList.remove("hover-style");
    });

    return button;
}

// Centralized function to add both buttons
function setupCustomButtons() {
    const estimateButton = createButton({
        id: 'Estimer-livraison',
        textContent: 'Estimer prix Colisweb',
        styles: { marginLeft: '48px', marginTop: '0px' },
        onClick: EstimerButtonAction
    });

     deliveryButton = createButton({
        id: 'programmer-la-livraison',
        textContent: 'Programmer la livraison',
        styles: { marginLeft: '38px', marginTop: '10px', display: 'none' },
        onClick: () => window.open('https://bo.production.colisweb.com/store/clients/249/stores/8481/create-delivery', '_blank')
    });

    function attemptToAddButtons() {
        const validerPanierContainer = document.querySelector('.ui-row.col-80-20.basket .secondary-col');
        if (validerPanierContainer && !document.getElementById('Estimer-livraison')) {
            const validerPanierButton = validerPanierContainer.querySelector('.js-proceed-checkout-btn');
            validerPanierContainer.insertBefore(estimateButton, validerPanierButton);
            validerPanierContainer.insertBefore(deliveryButton, estimateButton.nextSibling);
            console.log('Custom buttons added successfully');
            return deliveryButton;
        } else {
            console.log('Conditions not met to add buttons');
        }
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('.ui-row.col-80-20.basket .secondary-col') &&
            document.querySelector('.js-proceed-checkout-btn') &&
            !document.getElementById('Estimer-livraison')) {
                attemptToAddButtons();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Handler for the 'Estimer prix Colisweb' button click
async function EstimerButtonAction() {
    estimateButton.textContent: 'Calcul en cours...',
    const data = fetchEANsAndQuantities();
    const { address, postalCode } = fetchClientAddress();
    console.log("Fetched Postal Code:", postalCode);
    //const { firstName, name, phone } = fetchClientInfos();

    const geocodeData = await fetchGeocodeData(address);
    console.log("Geocode Data:", geocodeData);

    if (geocodeData && postalCode) {
        await onLivraisonButtonPress(data.map(item => item.ean), geocodeData, postalCode,);
    } else {
        console.log("Required data for calculating delivery options is missing.");
    }
}



let savCookie = ""; // Global variable to store the SAV cookie

async function setSavCookie() {
    //const url = "http://lnxs2952.gha.kfplc.com:8080/castoSav/";
    const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/";
    const headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Connection": "keep-alive",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    };

    //Mise à jour manuelle du cookie, peut être pas nécessaire, à voir si une simple requête fonctionne pour "set" le cookie
    //try {
    console.log("making the setSAVcookie request")
    await makeCORSRequest(url, "GET", headers);
    // Process the response
    //  const newCookie = response.headers['Set-Cookie'];
    //  if (newCookie) {
    //      savCookie = newCookie;
    //      console.log("SAV Cookie updated successfully");
    //  } else {
    //      console.error("Failed to update SAV cookie: Set-Cookie header missing");
    //  }
    // } catch (error) {
    //      console.error("Error setting new SAV cookie:", error);
    //   }
}

// Function to initialize session
async function initializeSession(savCookie) {
    const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/initAccueil.do";
    const headers = {
        "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": savCookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest"

    };
    const payload = "%2FcastoSav%2Fmain%2FinitAccueil.do&__AjaxCall__=true&_=";
    try {
        await makeCORSRequest(url, "POST", headers, payload);
        console.log("Session initialized successfully");
    } catch (error) {
        console.error("Error initializing session:", error);
        throw error; // Rethrow error to be caught by the caller
    }
}



// Function to fetch product ID by barcode
async function fetchProductCode(barcode, savCookie) {
    const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/validRechercheProduit.do";
    const headers = {
        "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": savCookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest"
    };
    const payload = `%2FcastoSav%2Fmain%2FvalidRechercheProduit.do&__FormAjaxCall__=true&filtreRechercherProduit_codeBarre=${encodeURIComponent(barcode)}&filtreRechercherProduit_LibMarque=&filtreRechercherProduit_idMarque=&filtreRechercherProduit_idSecteur=&filtreRechercherProduit_LibSdgSsFamMod=&filtreRechercherProduit_libelleProduit=&_=`;
    const responseText = await makeCORSRequest(url, "POST", headers, payload);
    console.log(responseText.substring(0, 50));

     // Check for failure response
    if (responseText.includes("Copyright (C)")) {
        console.log("Detected failure response, updating SAV cookie...");
        await setSavCookie();
        console.log("setSAVcookie1 finished")
        await setSavCookie();
        //notification("alert", "un moment s'il vous plaît...");
        //await delay(2000);
        window.location.reload()
    }

    return extractProductCode(responseText);
}



async function fetchPackageData(productId, cookie) {
    const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/initDetailProduit.do";
    const headers = {
        "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest"
    };
    const payload = `%2FcastoSav%2Fmain%2FinitDetailProduit.do&__AjaxCall__=true&idProduit=${encodeURIComponent(productId)}&isGoBack=false&_=`;
    let responseText = await makeCORSRequest(url, "POST", headers, payload);



    //console.log(responseText);
    return extractPackageData(responseText);
}




// Function to extract product code from response
function extractProductCode(responseXml) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(responseXml, "text/xml");
    var scriptTag = xmlDoc.getElementsByTagName('script')[0];
    if (scriptTag) {
        var cdata = scriptTag.textContent;
        var match = cdata.match(/voirProduit\((\d+),/);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}




// Function to extract package data from response
function extractPackageData(responseXml) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(responseXml, "text/xml");
    var cdataContent = xmlDoc.querySelector('data').textContent;

    // Use regex to find and extract weight and dimensions
    var weightAndDimensionRegex = /Poids et dimension<\/td>\s*<td class="info">([\s\S]*?)<\/td>/;
    var match = cdataContent.match(weightAndDimensionRegex);

    if (match && match[1]) {
        // Clean and normalize the captured text
        var textContent = match[1].replace(/\s/g, ' ').replace(/&nbsp;/g, ' ').trim();
        console.log("Text Content for Weight and Dimensions:", textContent);

        // Regex patterns to match the provided format
        var weightMatch = textContent.match(/(\d+(\.\d+)?)\s*kg/);
        var dimensionMatch = textContent.match(/(\d+(\.\d+)?)\s*[xX]\s*(\d+(\.\d+)?)\s*[xX]\s*(\d+(\.\d+)?)\s*cm/);

        var weight = "Unavailable";
        var dimensions = ["Unavailable", "Unavailable", "Unavailable"];

        if (weightMatch) {
            // console.log('Extracted weight:', weightMatch[0]);
            weight = convertAndStripUnit(weightMatch[0], 'kg');
        }

        if (dimensionMatch && dimensionMatch.length >= 6) {
            // console.log('Extracted dimensions:', dimensionMatch[0]);
            dimensions = dimensionMatch.slice(1, 6).filter(function(value, index) {
                return index % 2 === 0; // Take every second element (numeric values)
            }).map(function(dim) {
                return convertAndStripUnit(dim, 'cm');
            });
        }

        if (weight !== "Unavailable" && dimensions.every(function(dim) { return dim !== "Unavailable"; })) {
            return dimensions.concat(weight); // Concatenates dimensions and weight into the final array
        } else {
            return ["Unavailable", "Unavailable", "Unavailable", "", "Unavailable"];
        }
    }
}


// Function to convert and strip unit from the value
function convertAndStripUnit(value, unit) {
    if (typeof value === 'string') {
        var numericValue = parseFloat(value); // Extract the numeric part
        if (!isNaN(numericValue)) {
            numericValue = Math.round(numericValue); // Round the numeric value
            // console.log("Rounded numeric value:", numericValue);

            // Assuming unit conversion is not required and you just need the rounded value as a string
            return numericValue.toString();
        }
    }
    return "Unavailable";
}

function calculatePackageMetrics(fetchedData) {
    let totalNumberOfPackages = 0;
    let heaviestPackageWeight = 0;
    let totalWeight = 0;
    let longestPackageLength = 0;
    let longestPackage = null;

    for (const item of fetchedData) {
        // Ensure item.packageData is an array
        if (!Array.isArray(item.packageData)) {
            console.error('Invalid packageData format for item:', item);
            continue; // Skip this item
        }

        let [length, height, width, weight] = item.packageData.map(d => parseInt(d, 10));
        const quantity = parseInt(item.quantity, 10);

        // Sort dimensions to ensure the largest one is always treated as length
        [length, height, width] = [length, height, width].sort((a, b) => b - a);

        // Update total number of packages
        totalNumberOfPackages += quantity;

        // Update total weight
        totalWeight += weight * quantity;

        // Update heaviest package weight
        if (weight > heaviestPackageWeight) {
            heaviestPackageWeight = weight;
        }

        // Find the longest package
        if (length > longestPackageLength) {
            longestPackageLength = length;
            longestPackage = { length, height, width };
        }
    }

    // Output calculated metrics
    console.log('Total Number of Packages:', totalNumberOfPackages);
    console.log('Heaviest Package Weight:', heaviestPackageWeight);
    console.log('Total Weight:', totalWeight);
    console.log('Longest Package Length:', longestPackageLength);
    console.log('Longest Package Height:', longestPackage?.height);
    console.log('Longest Package Width:', longestPackage?.width);

    return {
        totalNumberOfPackages,
        heaviestPackageWeight,
        totalWeight,
        longestPackageLength,
        longestPackage
    };
}

let globalCookie = ""; // Initialize a global variable to store the cookie

async function setColiswebCookie() {
    console.log("fonction setColiswebCookie lancée");
    const url = "https://api.production.colisweb.com/api/v6/authent/external/session";
    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive",
        "Content-Length": "94",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": globalCookie,
    };
    const payload = {"username":"castometz012","password":"cw12"}

    try {
        const response = await makeCORSRequest(url, "PUT", headers, JSON.stringify(payload));
        console.log("making request for new cookie", response)
        // Extract the "Set-Cookie" header from the response and update the global cookie
        const newCookie = response.headers['Set-Cookie'];
        if (newCookie) {
            globalCookie = newCookie; // Update the global cookie with the new value
            console.log("Colisweb Cookie updated successfully :", globalCookie );
        } else {
            console.error("Failed to update Colisweb cookie: Set-Cookie header missing");
        }
    } catch (error) {
        console.error("Error setting new Colisweb cookie:", error);
    }
}

// Function to fetch delivery options
async function fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie) {


    console.log("Fetching delivery options with geocode data and package metrics");

    const url = "https://api.production.colisweb.com/api/v5/clients/249/stores/8481/deliveryOptions";
    const headers = {
        "Content-Type": "application/json",
        //"Cookie": "_hjSessionUser_2541602=eyJpZCI6IjY2YWUzNWM3LTc1NzMtNWQ4ZS04YjI1LTUzMGYxMWY3OWRmZSIsImNyZWF0ZWQiOjE2Nzg5NjA2MDE1NjUsImV4aXN0aW5nIjp0cnVlfQ==; session=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEwMjg1IiwidXNlcm5hbWUiOiJjYXN0b21ldHowMTIiLCJncm91cHMiOlsic3RvcmUtODQ4MSIsImNsaWVudC1wYXJlbnQtMjQ5Il0sInRyYW5zcG9ydGVySWQiOm51bGwsImNhcnJpZXJJZCI6bnVsbCwiY2xpZW50SWQiOiIyNDkiLCJzdG9yZUlkIjoiODQ4MSIsImZpYXQiOjE3MDY3Nzc5MjIsImlhdCI6MTcwNjc3ODUxNCwiZXhwIjoxNzA2ODE0NTE0LCJpc3MiOiIybFZ4QkdVUjdGc3puckhYOGNlTEtFVVNWSG5oRzR6RiJ9.sOQJqakuKV2P6gl7Ks18lHjhCVGRKB7ssLDxuJmsVoI"
        "Cookie": globalCookie
    };

    // Calculate dynamic dates
    const now = new Date(); // Represents the current date and time
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 2); // Adds 2 days to the current date


    const payload = {
        "startDate": now.toISOString(),
        "endDate": endDate.toISOString(),
        "pickupAddress": {
            "latitude": 49.0750948,
            "longitude": 6.1000448,
            "postalCode": "57130",
            "storeId": "8481",
            "geocodingLevel": "streetAddress",
            "administrativeArea": {
                "name": "",
                "code": "44",
                "code2": "57",
                "code3": "579",
                "countryCode": "FR"
            }
        },
        "shippingAddress": {
            "latitude": geocodeData.latitude,
            "longitude": geocodeData.longitude,
            "postalCode": postalCode,
            "additionalInformation": {
                "floor": null,
                "hasLift": "maybe_lift"
            },
            "geocodingLevel": "streetAddress",
            "administrativeArea": {
                "name": "Grand Est",
                "code": "44",
                "code2": "57",
                "code3": "579",
                "countryCode": "FR"
            }
        },
        "packaging": {
            "numberOfPackets": packageMetrics.totalNumberOfPackages,
            "heightCm": packageMetrics.longestPackage?.height,
            "lengthCm": packageMetrics.longestPackage?.length,
            "widthCm": packageMetrics.longestPackage?.width,
            "weightKg": packageMetrics.totalWeight,
            "maxPacketWeightKg": packageMetrics.heaviestPackageWeight,
            "maxPacketLengthCm": packageMetrics.longestPackageLength
        },
        "requiredSkills": ["sidewalkdelivery"]
    };

    try {
        const responseText = await makeCORSRequest(url, "POST", headers, JSON.stringify(payload));
        const responseJson = JSON.parse(responseText);
        console.log(responseText.substring(0, 50));

        if (!responseJson.calendar) {
            console.log("cockblocked");
            return "Unauthorized"
            notification("Veuillez vous reconnecter à Coliweb");
        } else if (responseJson.calendar && responseJson.calendar.length > 0) {
            const priceWithTaxes = responseJson.calendar[0].priceWithTaxes;
            console.log("Prix coliweb:", priceWithTaxes);
            const adjustedPrice = priceWithTaxes * 1.0376;
            const roundedPrice = parseFloat(adjustedPrice.toFixed(2));
            console.log("Prix Coliweb + marge:", adjustedPrice);
            notification("", "Prix livraison: " + roundedPrice + " €");
            return priceWithTaxes;
        } else {
            console.log("Calendar array is empty or undefined");
            alert("No price data available");
            return null;
        }
    } catch (error) {
        console.error("Error fetching delivery options:", error);
        alert("Error fetching delivery options: " + error.message);
        return null; // Or return a specific error indicator
    }
}


// Custom notifications
let popupWindow = null;
function notification(type, message, linkText,linkURL) {

    const notification = document.createElement("div");
    notification.innerText = message;
    notification.style.position = "fixed";
    notification.style.top = "50%";
    notification.style.left = "50%";
    //notification.style.transform = "translate(-50%, -50%)";
    notification.style.backgroundColor = "#af4c4c";
    notification.style.color = "white";
    notification.style.padding = "15px 30px";
    notification.style.borderRadius = "30px";
    notification.style.boxShadow = "0 0px 1px rgba(0,0,0,0.2)";
    notification.style.width = 'auto';
    notification.style.zIndex = "1000";
    notification.style.display = "flex";
    notification.style.flexDirection = "column";
    notification.style.alignItems = "center";
    notification.style.justifyContent = "center";
    notification.style.textAlign = "center";
    //ajouts
    notification.style.font = 'bold 1em / 1.25 Arial,Helvetica,sans-serif';
    notification.style.fontSize = "110%";
    notification.style.transition = "all 0.5s ease-in-out";
    notification.style.opacity = "0";
    notification.style.transform = "translate(-50%, -50%) scale(0)";
    //conditionals
    if (type == "alert") {
        notification.style.background = "linear-gradient(to right, rgba(175,76,76), rgba(157,68,68))"; }
    else {
        notification.style.backgroundColor = "#0078d7";}


    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = "1";
        notification.style.transform = "translate(-50%, -50%) scale(1)";
        notification.style.boxShadow = "0 10px 8px rgba(0,0,0,0.4)"


        }, 10);


    // If linkText and linkURL are provided, create and append the hyperlink
    if (linkText && linkURL) {
        const hyperlink = document.createElement("a");
        hyperlink.href = linkURL;
        hyperlink.innerText = ` ${linkText}`; // Space added before link text for separation
        hyperlink.style.color = "#ffff00"; // Example: yellow color for visibility
        hyperlink.style.textDecoration = "underline";
        //hyperlink.target = "_blank"; // Optional: Opens the link in a new tab

        // Event listener to open link in a popup window
        hyperlink.addEventListener("click", function(event) {
            event.preventDefault(); // Prevent the default anchor action
            popupWindow = window.open(linkURL, "popupWindow", "width=400,height=400,scrollbars=no");
        });

        // Append the hyperlink to the notification
        notification.appendChild(hyperlink);


        const lineBreak = document.createElement("br");
        notification.appendChild(lineBreak);

        // Append the hyperlink to the notification
        notification.appendChild(hyperlink);

    }

     setTimeout(() => {
        notification.style.opacity = '0'; // Initiate fade-out
    }, 5000);

    setTimeout(() => {
        notification.remove();
    }, 6000);

}






let deliveryDetails = {}
async function clearAndSetGMValues() {

    // Clear all data stored with GM_setValue
    const keys = await GM.listValues(); // Retrieve all keys
    console.log("Suppression des anciennes GMValues")
    keys.forEach(key => {
        GM.deleteValue(key); // Delete each key
    });


    //setting values
    deliveryDetails.lastUpdated = await new Date().toISOString();
    await GM.setValue("deliveryDetails", JSON.stringify(deliveryDetails));
    console.log("Data stored:", JSON.stringify(deliveryDetails));



    // Validate all data stored
    const storedDataJSON = await GM.getValue("deliveryDetails");
    const storedData = JSON.parse(storedDataJSON);
    // Compare the stored data with the expected data
    if (storedDataJSON && storedData.lastUpdated === deliveryDetails.lastUpdated) {
        console.log("Validation successful: Stored data matches expected data.");
    } else {
        console.error("Validation failed: Stored data does not match expected data.");
    }


}


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SCRIPT 1 : COM+
// Execution :

async function execution1() {
    const response = await fetchProductCode("3663602942986");
    if (!response.includes("Copyright (C)")) {
        await setupCustomButtons();
    } else console.error("Something went wrong with the initialisation of the cookie");
}




// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SCRIPT 1 : COM+
// Execution :

async function onLivraisonButtonPress(eans, geocodeData, postalCode, firstName, name, phone, button) {

    try {
        await initializeSession();
        fetchedProductData = []; // Reset fetched data

        // Fetch the EANs and quantities
        let productDataWithQuantities = fetchEANsAndQuantities();

        for (const ean of eans) {
            const productCode = await fetchProductCode(ean);
            if (productCode) {
                const packageData = await fetchPackageData(productCode);
                if (packageData) {
                    const quantity = productDataWithQuantities.find(item => item.ean === ean)?.quantity || '0';
                    fetchedProductData.push({ packageData, quantity });
                    console.log("Package Data for EAN " + ean + ": ", packageData);
                }
            } else throw new Error("Reconnexion au SAV nécessaire");

        }

        // Calculate package metrics
        const packageMetrics = calculatePackageMetrics(fetchedProductData);

        // Define a maximum number of retries
        const maxRetries = 2;
        let currentAttempt = 0;
        let response;
        response = await fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie);
        /*
        //Logique pour set le colisweb Cookie et retry (non nécessaire en cas de login manuel):
        do {
                response = await fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie);
                if (response === "Unauthorized" && currentAttempt < maxRetries) {
                    console.log("Fetching delivery options failed, attempting to update cookie...");
                    await setColiswebCookie(); // Attempt to set a new cookie
                    currentAttempt++;
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay

                } else {
                    break; // Exit loop if response is not "Unauthorized" or max retries reached
                }
            } while (currentAttempt < maxRetries);
 */
        // Handle response after exiting the loop


        if (response !== "Unauthorized") { //Colisweb API SUCCESS!
            // "success" scenario
            deliveryDetails = {
                address: fetchClientAddress().address || "Info manquante",
                packageMetrics: packageMetrics || "Info manquante",
                postalCode: postalCode || "Info manquante",
                firstName: firstName || "Coming soon...",
                name: name || "Coming soon...",
                phone: phone || "Coming soon...",
            };

            // Function to clear all stored data before adding new data
            await clearAndSetGMValues();

            if (deliveryButton) {
                deliveryButton.style.display = 'inline-block'; // Correctly reference and manipulate the global button
            }
            if (estimateButton) {
                estimateButton.textContent: 'Calcul en cours...'
            }

        } else {
            console.error("Failed to fetch delivery options after several attempts.")
            notification("alert", "Veuillez vous reconnecter à Colisweb", "Cliquez ici", "https://bo.production.colisweb.com/login");
            estimateButton.textContent: 'Calcul en cours...'
        }

    } catch (error) {
        console.error("An error occurred:", error);
        notification("alert", error);
        estimateButton.textContent: 'Calcul en cours...'
    }
}




// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// SCRIPT 2 (colsiweb log-in)
// Functions :

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



function isElementVisible(element) {
    return element && element.offsetParent !== null && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
}




async function autoFill(selector, value) {
    let inputField = document.querySelector(selector);

    // Wait until the element is visible
    do {
        await delay(500);
        inputField = document.querySelector(selector);
    } while (!inputField || !isElementVisible(inputField));

    console.log(`${selector} found and is visible. Setting placeholder.`);
    inputField.setAttribute('placeholder', value);
}



//Fonction pour détecter l'API
function closePopup() {
    // Save the original open and send functions of XMLHttpRequest
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        // If the request URL is the one we're interested in, modify the send function
        if (url.includes('external')) {
            this.addEventListener('load', function() {
                if (this.status === 200) {
                    console.log("Api request success");
                    // Call your desired function here
                    window.close();
                    popupWindow = null;
                }
            });
        }
        // Call the original open method
        originalOpen.apply(this, arguments);
    };

    // The send method is left untouched; we just need to ensure it's defined after open
    XMLHttpRequest.prototype.send = originalSend;


}





// ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// EXECUTION Script 2 (colisweb Login) :

const logID = "Y2FzdG9tZXR6MDEy";
const logPW = "Y3cxMg=="


async function execution2() {

    console.log("execution script 2 (login)");
    autoFill("#username", atob(logID));
    autoFill("#Password", atob(logPW));
    closePopup();
}






// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// SCRIPT 3 : Colisweb Autfill
// Functions

// Function to retrieve and log the stored delivery details
async function fetchDeliveryDetails() {
    const storedDeliveryDetails = await GM.getValue("deliveryDetails", "{}");
    console.log("Manually retrieved Data:", storedDeliveryDetails);
    //let deliveryDetails;

    try {
        deliveryDetails = JSON.parse(storedDeliveryDetails);
        console.log("Delivery details chopés:", deliveryDetails);
        return deliveryDetails; // Return the parsed object
    } catch(e) {
        console.error("Error parsing delivery details:", e);
        return {}; // Return an empty object in case of error
    }
}



// Listvalues
async function listvalues(){
    const keys = await GM.listValues(); // Retrieve all keys
    console.log("liste des clés retrouvées dans le script 2:", keys)
}




// Function to attempt to set the address value
let addressInput = null;

async function fillAddress() {
    console.log("fillAddress lancée");
    // Check if the deliveryDetails object contains the address
    if (deliveryDetails.address) {
        console.log("searching for input field...");
        do{
            addressInput = document.querySelector('[id^="headlessui-combobox-input-"]');
            await delay(50);
        }while (!addressInput);
        if (addressInput) {
            console.log("Address input field found");
            addressInput.value = deliveryDetails.address;
            // Trigger any required events after setting the value
        } else {
            console.error("Address input field not found");
        }
    }
}



//Met place holder automatiquement
async function autoPlaceHolder(selector, value) {
    let inputField = document.querySelector(selector);

    do {
        await delay(500);
        inputField = document.querySelector(selector);
    } while (!inputField || !isElementVisible(inputField));

    console.log(`${selector} found and is visible. Setting placeholder.`);
    inputField.setAttribute('placeholder', value);
}



async function highlightBooleanHeight(value) {
    let boolean = null
    console.log("Valeur utilisée pour booléen : ", value);
    let presenceBoolean = null;
    do {
        presenceBoolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.lessThan150");
        await delay(200);
    } while (!presenceBoolean);
    console.log("booléen détecté");


    if (value < 150){
        console.log("condition -150 remplie");
        boolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.lessThan150");
        boolean.style.transition = "all 1s ease-in-out";
        await delay(10);
        boolean.style.backgroundColor = '#9fe8f2';

    } else if (value >149 && value <181) {
        console.log("condition 150<>180 remplie");
        boolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.my-6.between150And180");
        boolean.style.transition = "all 1s ease-in-out";
        await delay(10);
        boolean.style.backgroundColor = '#9fe8f2';

    } else if (value >180) {
        console.log("condition >180 remplie");
        boolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.moreThan180");
        boolean.style.transition = "all 1s ease-in-out";
        await delay(10);
        boolean.style.backgroundColor = '#9fe8f2';
    }


}

async function highlightBooleanWidth(value) {
    let boolean = null
    console.log("Valeur utilisée pour booléen width: ", value);
    let presenceBoolean = null;
    do {
        presenceBoolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.mb-6.lessThanOrEqualTo50");
        await delay(200);

    }while(!presenceBoolean);
    console.log("booléen width détecté");

    if (value < 51){
        console.log("condition -50 remplie");
        boolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.mb-6.lessThanOrEqualTo50");
        boolean.style.transition = "all 1s ease-in-out";
        await delay(10);
        boolean.style.backgroundColor = '#9fe8f2';

    }else if (value >50) {
        console.log("condition +50 remplie");
        boolean = document.querySelector("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div.flex.mb-4 > div > label.flex.items-center.cursor-pointer.bg-neutral-100.border.border-neutral-100.p-1.rounded-lg.hover\\:border-primary-600.moreThan50");
        boolean.style.transition = "all 1s ease-in-out";
        await delay(10);
        boolean.style.backgroundColor = '#9fe8f2';

    }else {
        console.log("erreur dans la dimension")
    }


}




// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// SCRIPT 3 : Colisweb Autofill
// Execution :

async function execution3() {

    console.log("execution script 3");
    //notification("alert", "Notification test")

    const deliveryDetails = await fetchDeliveryDetails();

    await fillAddress();

    autoPlaceHolder("#recipientFirstName", deliveryDetails.firstName.toString());
    //autoFill("#root > div > div:nth-child(2) > main > div > div > div:nth-child(2) > div.w-full.ml-8 > form > div > div:nth-child(2) > div:nth-child(1) > div.w-full.mr-4.firstname > div > label", deliveryDetails.firstName.toString());

    autoPlaceHolder("#recipientLastName", deliveryDetails.name.toString());
    //autoFill("#recipientLastName", deliveryDetails.name.toString());

    autoPlaceHolder("#phone1", deliveryDetails.phone.toString());
    //autoFill("#phone1", deliveryDetails.phone.toString());

    await autoPlaceHolder("#packagesQuantity", deliveryDetails.packageMetrics.totalNumberOfPackages.toString());

    autoPlaceHolder("#heaviest", deliveryDetails.packageMetrics.heaviestPackageWeight.toString());
    autoPlaceHolder("#weight", deliveryDetails.packageMetrics.heaviestPackageWeight.toString());

    autoPlaceHolder("#totalWeight", deliveryDetails.packageMetrics.totalWeight.toString());


    autoPlaceHolder("#longest", deliveryDetails.packageMetrics.longestPackage.length.toString());
    await autoPlaceHolder("#length", deliveryDetails.packageMetrics.longestPackage.length.toString());

    highlightBooleanHeight(deliveryDetails.packageMetrics.longestPackage.height);
    highlightBooleanWidth(deliveryDetails.packageMetrics.longestPackage.width);


}



// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



// MAIN :

(async function main() {
    'use strict';
    const domain = window.location.hostname;
    const path = window.location.pathname;

    if (domain === "prod-agent.castorama.fr") { // Com+
        await execution1();
    } else if (path.includes("/login")) { // Log-in Popup
        await execution2();
    } else if (path.includes("create-delivery")) { // Colisweb
        await execution3();
    }
})();
