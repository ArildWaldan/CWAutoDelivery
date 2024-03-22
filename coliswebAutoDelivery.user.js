// ==UserScript==
// @name         Coliweb Livraison Calculator2
// @namespace    cstrm.scripts/colisweb1
// @version      1.30
// @downloadURL  https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery.user.js
// @updateURL    https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery.user.js
// @description  Fetch and log package specifications
// @author       Arnaud D.
// @connect      https://bo.production.colisweb.com/*
// @connect      http://agile.intranet.castosav.castorama.fr:8080/*
// @connect      https://api.production.colisweb.com
// @connect      *
// @match        http://agile.intranet.castosav.castorama.fr:8080/*
// @match        https://*.castorama.fr/*
// @match        https://bo.production.colisweb.com/*
// @exclude      https://www.castorama.fr/
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


// Define the LoaderManager object
const LoaderManager = {
    init: function() {
        this.injectLoaderHTML();
        this.injectCSS();
    },

    injectLoaderHTML: function() {
        const loaderHTML = `
            <div id="tmLoader" class="loader" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
    },

    injectCSS: function() {
        const css = `
.loader {
        height: 5px;
        width: 5px;
        color: #3498db;
        box-shadow: -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px;
        animation: loader-38 6s infinite;
      }

      @keyframes loader-38 {
        0% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
        8.33% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px;
        }
        16.66% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px;
        }
        24.99% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        33.32% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px -10px 0 5px;
        }
        41.65% {
          box-shadow: 10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px -10px 0 5px;
        }
        49.98% {
          box-shadow: 10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px;
        }
        58.31% {
          box-shadow: -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        66.64% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        74.97% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        83.3% {
          box-shadow: -10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        91.63% {
          box-shadow: -10px -10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        100% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
      }


  }
}
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    },

    show: function() {
        const loader = document.getElementById('tmLoader');
        if (loader) loader.style.display = 'block';
    },

    hide: function() {
        const loader = document.getElementById('tmLoader');
        if (loader) loader.style.display = 'none';
    }
};

function createLoading(){
    window.LoaderManager.show()
}

// Initialize loader
LoaderManager.init();

// Attach LoaderManager to the window object to make it globally accessible
window.LoaderManager = LoaderManager;


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
    } else {
        LoaderManager.hide();
        notification("alert", "Verifiez les coordonnées client.");
        estimateButton.textContent = 'Estimer prix Colisweb';
        throw new Error("Verifiez coordonnées client");
    }

    // Cleaning and formatting the address
    address = address.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();

    var postalCodeMatch = address.match(/\b\d{5}\b/);
    var postalCode = postalCodeMatch ? postalCodeMatch[0] : null;

    console.log("Address:", address);
    console.log("Extracted Postal Code:", postalCode);

    // Return both address and postalCode
    if (address && postalCode) {
        return { address, postalCode };

    } else {
        LoaderManager.hide();
        estimateButton.textContent = 'Estimer prix Colisweb';
        notification("alert", "Verifiez les coordonnées client.");
        throw new Error("Verifiez coordonnées client");

    }
}


// Function to fetch the client's contact info
function fetchClientInfos() {
    var nameSelector = '.col1.cust-del-add-col1 dl.definition-desc-inline dd'; // Selector for the name
    var phoneSelectorFixed = '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(1)'; // Selector for the fixed phone number
    var phoneSelectorMobile = '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(2)'; // Selector for the mobile phone number

    var nameElement = document.querySelector(nameSelector);
    var phoneElementFixed = document.querySelector(phoneSelectorFixed);
    var phoneElementMobile = document.querySelector(phoneSelectorMobile);

    let fullName = '';
    let firstName = '';
    let name = '';
    let phoneFixed = '';
    let phoneMobile = '';

    if (nameElement && nameElement.textContent.trim() !== '') {
        fullName = nameElement.textContent.trim().replace(/\s+/g, ' '); // Clean up and normalize whitespace
        // Remove prefixes like "M.", "Mme", or "Mlle"
        fullName = fullName.replace(/^(M\.|Mme|Mlle)\s*/, '');

        // Split the full name assuming the first part is the last name and the rest is the first name
        let nameParts = fullName.split(' ');
        if (nameParts.length > 1) {
            firstName = nameParts[0]; // The first part is the last name
            name = nameParts.slice(1).join(' '); // The rest is the first name(s)
        } else {
            // If only one part, it's a special case, adjust as needed
            firstName = fullName;
        }
    }

    if (phoneElementFixed && phoneElementFixed.textContent.trim() !== '') {
        phoneFixed = phoneElementFixed.textContent.trim();
    }

    if (phoneElementMobile && phoneElementMobile.textContent.trim() !== '') {
        phoneMobile = phoneElementMobile.textContent.trim();
    }

    console.log("First Name:", firstName);
    console.log("Last Name:", name);
    console.log("Fixed Phone: ", phoneFixed);
    console.log("Mobile Phone: ", phoneMobile);
    const phone = phoneMobile || phoneFixed;
    console.log("Phone:", phone);

    return {firstName, name, phoneFixed, phoneMobile, phone};
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
            notification ("alert", "Erreur de géolocalisation" + error);
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
    notification("alert", "Problème avec l'adresse - géolocalisation impossible");
    return null;
}


// Déclaration de la variable du buton "programmer la livraison" pour le rendre accessible à onLivraisonButtonPress()
let deliveryButton;
let estimateButton;
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

    const versionButton = createButton({
    id: 'versionButton',
        textContent: 'Estimer prix Colisweb',
        styles: { marginLeft: '48px', marginTop: '0px', width: '148px' },
        onClick: EstimerButtonAction
    });
    estimateButton = createButton({
        id: 'Estimer-livraison',
        textContent: 'Estimer prix Colisweb',
        styles: { marginLeft: '48px', marginTop: '0px', width: '148px' },
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
    createLoading();
    estimateButton.textContent = 'Calcul en cours...';
    const data = fetchEANsAndQuantities();
    const { address, postalCode } = fetchClientAddress();
    console.log("Fetched Postal Code:", postalCode);
    const { firstName, name, phone } = fetchClientInfos();

    const geocodeData = await fetchGeocodeData(address);
    console.log("Geocode Data:", geocodeData);

    if (geocodeData && postalCode) {
        await onLivraisonButtonPress(data.map(item => item.ean), geocodeData, postalCode,firstName, name, phone, address); //eans, geocodeData, postalCode, firstName, name, phone, button)
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
    try {
        console.log("making the setSAVcookie request")
        const response = await makeCORSRequest(url, "GET", headers);
        console.log("SAVCookie response : ", response);
    //Process the response
     // const newCookie = response.headers['Set-Cookie'];
     // if (newCookie) {
     //     savCookie = newCookie;
     //     console.log("SAV Cookie updated successfully");
     // } else {
     //     console.error("Failed to update SAV cookie: Set-Cookie header missing");
     // }
    } catch (error) {
         console.error("Error setting new SAV cookie:", error);
      }
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


let SAV_popupWindow = null;
// Function to fetch product ID by barcode
async function fetchProductCode(barcode, savCookie) {
    const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/validRechercheProduit.do";
    const headers = {
        "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        //"Cookie": savCookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest"
    };
    const payload = `%2FcastoSav%2Fmain%2FvalidRechercheProduit.do&__FormAjaxCall__=true&filtreRechercherProduit_codeBarre=${encodeURIComponent(barcode)}&filtreRechercherProduit_LibMarque=&filtreRechercherProduit_idMarque=&filtreRechercherProduit_idSecteur=&filtreRechercherProduit_LibSdgSsFamMod=&filtreRechercherProduit_libelleProduit=&_=`;
    const responseText = await makeCORSRequest(url, "POST", headers, payload);
    console.log(responseText.substring(0, 50));

    // Check for failure response
    //let attemptCount = await GM.getValue('attemptCount') || 0;
    //console.log("Nombre de tentatives tentées: 0", attemptCount);
    //if (attemptCount < 2) {

        if (responseText.includes("Copyright (C)")) {
            console.log("Detected cookie failure response, updating SAV cookie...");

            await setSavCookie();
            console.log("setSAVcookie1 finished");

            SAV_popupWindow = window.open("http://agile.intranet.castosav.castorama.fr:8080/castoSav", "SAV_popupWindow", "width=100,height=100,scrollbars=no");
            console.log("opening SAV popup");
            await delay(1000);
            await setupCustomButtons();
            return responseText;

        } else if (!responseText.includes("Copyright (C)")){
            console.log("SAV correct");

    } else {
        console.error('Maximum attempts to set the cookie exceeded');
        await GM.setValue('attemptCount', 0);

        //Logic pop up sav
        SAV_popupWindow = window.open("http://agile.intranet.castosav.castorama.fr:8080/castoSav", "SAV_popupWindow", "width=100,height=100,scrollbars=no");
        console.log("opening SAV popup");
        await delay(1000);
        await setupCustomButtons();
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

    const logID = "Y2FzdG9tZXR6MDEy";
    const logPW = "Y3cxMg==";

    console.log("fonction setColiswebCookie lancée");
    const url = "https://api.production.colisweb.com/api/v6/authent/external/session";
    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "X-Prototype-Version": "1.5.1.2",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": globalCookie


    };
    const payload = {
        password: atob(logPW),
        username: atob(logID),
    }

    try {
        const response = await makeCORSRequest(url, "POST", headers, JSON.stringify(payload)); //POST !!!!
        console.log("making request for new cookie", response)
/*         //Here I need to get hold of the cookie set by the response, and probably GM.setValue it, so it can be used as basis for next session creation.
        // Extract the "Set-Cookie" header from the response and update the global cookie
        const newCookie = response.headers['Set-Cookie'];
        if (newCookie) {
            globalCookie = newCookie; // Update the global cookie with the new value
            console.log("Colisweb Cookie updated successfully :", globalCookie );
        } else {
            console.error("Failed to update Colisweb cookie: Set-Cookie header missing");
        } */
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


    // RESPONSE PARSING
    try {
        const responseText = await makeCORSRequest(url, "POST", headers, JSON.stringify(payload));
        const responseJson = JSON.parse(responseText);
        console.log(responseText.substring(0, 50));

        if (responseJson.code && responseJson.code.includes('EXPIRED')) {
            LoaderManager.hide();
            console.log("cockblocked");
            return responseJson;

        } else if (responseJson.exp?.includes("expired") || responseJson.message?.includes("Unauthorized")) {
            LoaderManager.hide();
            console.log("cockblocked : ", responseJson);
            return responseJson;

        } else if (responseJson.code && responseJson.code.includes('LOAD')) {
            LoaderManager.hide();
            notification("alert", "Aucune offre coliweb compatible pour cette commande, faites une demande de devis via ", "ce formulaire", "https://bo.production.colisweb.com/store/clients/249/stores/8481/quotation")
            throw new Error("Pas de formules coliweb existantes");
            return ("no_offer");

        } else if (responseJson.error && responseJson.error.includes('distance')) {
            LoaderManager.hide();
            notification("alert", "Pas d'offres existantes à cette distance.");
            return ("distance");
            throw new Error("Pas de formules pour cette distance");


        } else if (responseJson.error && responseJson.error.includes('heavy')) {
            console.log("Response includes heavy");
            LoaderManager.hide();
            notification("alert", "Cette commande est trop lourde pour Coliweb, faites une demande de devis via ", "ce formulaire", "https://bo.production.colisweb.com/store/clients/249/stores/8481/quotation")
            //throw new Error("Pas de formules coliweb existantes");
            return ("heavy");


        } else if (responseJson.calendar && responseJson.calendar.length > 0) {
            const priceWithTaxes = responseJson.calendar[0].priceWithTaxes;
            console.log("Prix coliweb:", priceWithTaxes);
            const adjustedPrice = priceWithTaxes * 1.0376;
            const roundedPrice = parseFloat(adjustedPrice.toFixed(2));
            console.log("Prix Coliweb + marge:", adjustedPrice);
            LoaderManager.hide();
            notification("", "Prix livraison: " + roundedPrice + " €");
            return priceWithTaxes;
        } else {
            LoaderManager.hide();
            console.log("Calendar array is empty or undefined");
            alert("No price data available");
            return null;
        }
    } catch (error) {
        console.error("Error fetching delivery options:", error);
        LoaderManager.hide();
        //throw new Error ("error");
        return ("Erreur inconue"); // Or return a specific error indicator
    }
}


// Custom notifications setup
let lastNotificationBottom = 0;
let notificationsCount = 0; // Track the number of active notifications
let CW_popupWindow = null;

function notification(type, message, linkText, linkURL) {
    const notification = document.createElement("div");
    notification.innerText = message;
    notification.style.position = "fixed";
    notification.style.left = "50%";
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
    notification.style.font = 'bold 1em / 1.25 Arial, Helvetica, sans-serif';
    notification.style.fontSize = "110%";
    notification.style.transition = "all 0.5s ease-in-out";
    notification.style.opacity = "0";
    notification.style.transform = "translate(-50%, -100%) scale(0)";

    if (type == "alert") {
        notification.style.background = "linear-gradient(to right, rgba(175,76,76), rgba(157,68,68))";
    } else {
        notification.style.backgroundColor = "#0078d7";
    }

    document.body.appendChild(notification);
    notificationsCount++;

    // Force reflow/repaint
    const forcedReflow = notification.offsetHeight;

    if (lastNotificationBottom === 0) {
        notification.style.top = "50%";
        notification.style.transform = "translate(-50%, -50%) scale(0)";
    } else {
        notification.style.top = `${lastNotificationBottom + 50}px`;
        notification.style.transform = "translate(-50%, 0) scale(0)";
    }

    // Delay to allow the browser to render and calculate sizes
    setTimeout(() => {
        notification.style.opacity = "1";
        notification.style.transform = "translate(-50%, -50%) scale(1)";
        if (lastNotificationBottom !== 0) {
            notification.style.transform = "translate(-50%, 0) scale(1)";
        }

        // Update the position for the next notification
        const notificationRect = notification.getBoundingClientRect();
        lastNotificationBottom = notificationRect.bottom;
    }, 10);

    if (linkText && linkURL) {
        const hyperlink = document.createElement("a");
        hyperlink.href = linkURL;
        hyperlink.innerText = ` ${linkText}`;
        hyperlink.style.color = "#ffff00";
        hyperlink.style.textDecoration = "underline";
        hyperlink.addEventListener("click", function(event) {
            event.preventDefault();
            CW_popupWindow = window.open(linkURL, "CW_popupWindow", "width=400,height=400,scrollbars=no");
        });

        notification.appendChild(hyperlink);
    }

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
            notificationsCount--;
            if (notificationsCount === 0) {
                lastNotificationBottom = 0;
            }
        }, 600); // Slightly offset to allow for transition overlap
    }, 5000);
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
        console.log("SAV cookie mis en place correctement")
    } else console.error("Something went wrong with the initialisation of the cookie");
}




// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SCRIPT 1 : COM+
// Execution :

async function onLivraisonButtonPress(eans, geocodeData, postalCode, firstName, name, phone, address) {

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
            } else {
                console.error(`Error: Article with EAN ${ean} non-existent in the SAV portal.`);
                notification("alert", `Erreur : article avec EAN ${ean} inexistant sur le portail SAV.`);
            }

        }

        // Calculate package metrics
        const packageMetrics = calculatePackageMetrics(fetchedProductData);

        // Define a maximum number of retries
        const maxRetries = 2;
        let currentAttempt = 0;
        let response;
        response = await fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie);
        console.log("response to fetchDeliveryOptions returned: ", response);

        if (response?.exp?.includes("expired") || response?.message?.includes("Unauthorized")) {
            console.log("Session coliweb invalide");
            await setColiswebCookie();
            response = await fetchDeliveryOptions();


        } else if (response === "heavy" || response === "distance" || response === "no_offer") {
            console.log("Soft exit :", response);
            return;



        } else if (response) { //Colisweb API SUCCESS!
            // "success" scenario
            deliveryDetails = {
                address:  address || fetchClientAddress().address || "Info manquante",
                packageMetrics: packageMetrics || "Info manquante",
                postalCode: postalCode || "Info manquante",
                firstName: firstName || fetchClientInfos().firstName,
                name: name || fetchClientInfos().name,
                phone: phone || fetchClientInfos().phone,
            };

            // Function to clear all stored data before adding new data
            await clearAndSetGMValues();

            if (deliveryButton) {
                deliveryButton.style.display = 'inline-block'; // Correctly reference and manipulate the global button
            }
            if (estimateButton) {
                estimateButton.textContent = 'Estimer prix Colisweb';
            }


        } else {
            console.error("Failed to fetch delivery options.")
            LoaderManager.hide();
            notification("alert", "Veuillez vous reconnecter à Colisweb", "Cliquez ici", "https://bo.production.colisweb.com/login");
            estimateButton.textContent = 'Estimer prix Colisweb';
        }

    } catch (error) {
        estimateButton.textContent = 'Estimer prix Colisweb'
        console.error("An error occurred:", error);
        notification("alert", "Calcul impossible. ", error);
        LoaderManager.hide();
        ;

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
    function closePopup(keyword) {
        // Save the original open and send functions of XMLHttpRequest
        var originalOpen = XMLHttpRequest.prototype.open;
        var originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            // If the request URL is the one we're interested in, modify the send function
            if (url.includes(keyword)) {
                this.addEventListener('load', function() {
                    if (this.status === 200) {
                        console.log("Api request success");
                        // Call your desired function here
                        CW_popupWindow = null;
                        SAV_popupWindow = null;
                        window.close();

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
        closePopup('external');
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

    // POP UP Casto SAV

    async function execution4() {
        //Close pop-up after successfull request to SAV API
        await delay (0);
        closePopup("initAccueil.do");
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
        } else if (domain.includes("agile.intranet.castosav.castorama.fr:8080/") && path.includes("castoSav") ) { // SAV
            await execution4();
        }
    })();
