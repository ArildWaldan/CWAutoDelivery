// ==UserScript==
// @name         Coliweb Livraison Calculator2 – Improved
// @namespace    cstrm.scripts/colisweb1
// @version      1.30
// @downloadURL  https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery.user.js
// @updateURL    https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery.user.js
// @description  Improved version – Fetch and log package specifications with better reliability and readability
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

(() => {
    'use strict';

    // -----------------------------
    // CONFIGURATION & CONSTANTS
    // -----------------------------
    const GEO_API_KEY = "65ae97aa4417a328160769gcb8adb4f";
    const DELAY_MS = 500;
    const RETRY_DELAY_MS = 1000;
    const MAX_RETRIES = 2;
    const DEFAULT_PACKAGE_DATA = ["Unavailable", "Unavailable", "Unavailable", "Unavailable"];

    // -----------------------------
    // UTILITY FUNCTIONS
    // -----------------------------
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const isElementVisible = element =>
        element &&
        element.offsetParent !== null &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';

    // Wrapper for GM_xmlhttpRequest that returns a Promise
    const makeCORSRequest = (url, method, headers = {}, payload = null) =>
        new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data: payload,
                onload: response => resolve(response.responseText),
                onerror: error => reject(error)
            });
        });

    // -----------------------------
    // LOADER MANAGER
    // -----------------------------
    const LoaderManager = {
        init: () => {
            LoaderManager.injectLoaderHTML();
            LoaderManager.injectCSS();
        },
        injectLoaderHTML: () => {
            const loaderHTML = `
                <div id="tmLoader" class="loader" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;"></div>
            `;
            document.body.insertAdjacentHTML('beforeend', loaderHTML);
        },
        injectCSS: () => {
            const css = `
                .loader {
                    height: 5px;
                    width: 5px;
                    color: #3498db;
                    box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px;
                    animation: loader-38 6s infinite;
                }
                @keyframes loader-38 {
                    0% { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
                    8.33% { box-shadow: -10px -10px 0 5px, 10px -10px 0 5px, 10px -10px 0 5px, 10px -10px 0 5px; }
                    16.66% { box-shadow: -10px -10px 0 5px, 10px -10px 0 5px, 10px 10px 0 5px, 10px 10px 0 5px; }
                    24.99% { box-shadow: -10px -10px 0 5px, 10px -10px 0 5px, 10px 10px 0 5px, -10px 10px 0 5px; }
                    33.32% { box-shadow: -10px -10px 0 5px, 10px -10px 0 5px, 10px 10px 0 5px, -10px -10px 0 5px; }
                    41.65% { box-shadow: 10px -10px 0 5px, 10px -10px 0 5px, 10px 10px 0 5px, 10px -10px 0 5px; }
                    49.98% { box-shadow: 10px 10px 0 5px, 10px 10px 0 5px, 10px 10px 0 5px, 10px 10px 0 5px; }
                    58.31% { box-shadow: -10px 10px 0 5px, -10px 10px 0 5px, 10px 10px 0 5px, -10px 10px 0 5px; }
                    66.64% { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, 10px 10px 0 5px, -10px 10px 0 5px; }
                    74.97% { box-shadow: -10px -10px 0 5px, 10px -10px 0 5px, 10px 10px 0 5px, -10px 10px 0 5px; }
                    83.3% { box-shadow: -10px -10px 0 5px, 10px 10px 0 5px, 10px 10px 0 5px, -10px 10px 0 5px; }
                    91.63% { box-shadow: -10px -10px 0 5px, -10px 10px 0 5px, -10px 10px 0 5px, -10px 10px 0 5px; }
                    100% { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = css;
            document.head.appendChild(styleSheet);
        },
        show: () => {
            const loader = document.getElementById('tmLoader');
            if (loader) loader.style.display = 'block';
        },
        hide: () => {
            const loader = document.getElementById('tmLoader');
            if (loader) loader.style.display = 'none';
        }
    };

    // Make LoaderManager available globally (if needed elsewhere)
    window.LoaderManager = LoaderManager;
    LoaderManager.init();

    // -----------------------------
    // HARD CODED DATA
    // -----------------------------
    const hardcodedProductDetails = {
        "3663602431893": {
            packageData: ["15", "15", "40", "2.5"], // L, W, H, Weight (kg)
            description: "Neva Platine"
        }
        // Add more entries if needed
    };

    // -----------------------------
    // FETCH FUNCTIONS
    // -----------------------------
    const fetchEANsAndQuantities = () => {
        const eanElements = document.querySelectorAll('.js-ean-val');
        return Array.from(eanElements).map(eanEl => {
            const ean = eanEl.textContent.trim();
            const qtyEl = eanEl.closest('tr').querySelector('.js-basket-qty-change');
            const quantity = qtyEl ? qtyEl.value.trim() : '0';
            return { ean, quantity };
        });
    };

    const fetchClientAddress = () => {
        const deliverySel = '.js-saved-delivery-address .accord-content .panel-inner .cust-del-add-col1 dd address';
        const billingSel  = '.accord-content .panel-inner .cust-del-add-col1 dd address';

        let address = '';
        const deliveryEl = document.querySelector(deliverySel);
        const billingEl = document.querySelector(billingSel);

        if (deliveryEl && deliveryEl.textContent.trim() !== '') {
            address = deliveryEl.textContent.trim();
        } else if (billingEl) {
            address = billingEl.textContent.trim();
        } else {
            LoaderManager.hide();
            notification("alert", "Vérifiez les coordonnées client.");
            if (estimateButton) estimateButton.textContent = 'Estimer prix Colisweb';
            throw new Error("Coordonnées client manquantes");
        }

        address = address.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
        const postalCodeMatch = address.match(/\b\d{5}\b/);
        const postalCode = postalCodeMatch ? postalCodeMatch[0] : null;

        console.log("Address:", address, "| Postal Code:", postalCode);
        if (address && postalCode) {
            return { address, postalCode };
        } else {
            LoaderManager.hide();
            if (estimateButton) estimateButton.textContent = 'Estimer prix Colisweb';
            notification("alert", "Vérifiez les coordonnées client.");
            throw new Error("Adresse ou code postal introuvable");
        }
    };

    const fetchClientInfos = () => {
        const nameSel = '.col1.cust-del-add-col1 dl.definition-desc-inline dd';
        const phoneFixedSel = '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(1)';
        const phoneMobileSel = '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(2)';

        const nameEl = document.querySelector(nameSel);
        const phoneFixedEl = document.querySelector(phoneFixedSel);
        const phoneMobileEl = document.querySelector(phoneMobileSel);

        let firstName = '', lastName = '';
        if (nameEl && nameEl.textContent.trim() !== '') {
            let fullName = nameEl.textContent.trim().replace(/\s+/g, ' ');
            fullName = fullName.replace(/^(M\.|Mme|Mlle)\s*/, '');
            const parts = fullName.split(' ');
            if (parts.length > 1) {
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
            } else {
                firstName = fullName;
            }
        }
        const phoneFixed = phoneFixedEl ? phoneFixedEl.textContent.trim() : '';
        const phoneMobile = phoneMobileEl ? phoneMobileEl.textContent.trim() : '';
        const phone = phoneMobile || phoneFixed;
        console.log("Client infos - First Name:", firstName, "| Last Name:", lastName, "| Phone:", phone);
        return { firstName, name: lastName, phoneFixed, phoneMobile, phone };
    };

    const fetchGeocodeData = async (address) => {
        console.log("Fetching geocode for:", address);
        const attemptGeocode = async queryAddress => {
            const url = `https://geocode.maps.co/search?q=${encodeURIComponent(queryAddress)}&api_key=${GEO_API_KEY}`;
            try {
                const resText = await makeCORSRequest(url, "GET");
                const data = JSON.parse(resText);
                if (data && data.length > 0) {
                    const { lat, lon } = data[0];
                    console.log("Geocode result:", lat, lon);
                    return { latitude: lat, longitude: lon };
                }
            } catch (err) {
                notification("alert", "Erreur de géolocalisation : " + err);
                console.error("Geocode error:", err);
            }
            return null;
        };

        let geoData = await attemptGeocode(address);
        if (geoData) return geoData;

        // Retry without house number
        const addrNoHouse = address.replace(/^\d+\s*/, '');
        console.log("Retry geocode without house number:", addrNoHouse);
        await delay(RETRY_DELAY_MS);
        geoData = await attemptGeocode(addrNoHouse);
        if (geoData) return geoData;

        // Try using postal code and city extraction
        const cityRegex = /\b\d{5}\b\s*(.*)/;
        const match = address.match(cityRegex);
        if (match && match[1]) {
            const city = match[1].trim();
            const postalCode = address.match(/\b\d{5}\b/)[0];
            console.log("Retry geocode with city and postal:", city, postalCode);
            await delay(RETRY_DELAY_MS);
            geoData = await attemptGeocode(`${city} ${postalCode}`);
            if (geoData) return geoData;
        }
        console.log("Geocode data not found after retries");
        notification("alert", "Problème avec l'adresse - géolocalisation impossible");
        return null;
    };

    const extractProductCode = responseXml => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(responseXml, "text/xml");
        const scriptTag = xmlDoc.getElementsByTagName('script')[0];
        if (scriptTag) {
            const match = scriptTag.textContent.match(/voirProduit\((\d+),/);
            return (match && match[1]) || null;
        }
        return null;
    };

    const extractPackageData = responseXml => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(responseXml, "text/xml");
        const dataEl = xmlDoc.querySelector('data');
        if (!dataEl) return DEFAULT_PACKAGE_DATA;
        const cdata = dataEl.textContent;
        const weightMatch = cdata.match(/(\d+(\.\d+)?)\s*kg/);
        const dimensionMatch = cdata.match(/(\d+(\.\d+)?)\s*[xX]\s*(\d+(\.\d+)?)\s*[xX]\s*(\d+(\.\d+)?)\s*cm/);
        const weight = weightMatch ? Math.round(parseFloat(weightMatch[0])) + "" : "Unavailable";
        let dimensions = ["Unavailable", "Unavailable", "Unavailable"];
        if (dimensionMatch && dimensionMatch.length >= 6) {
            dimensions = dimensionMatch.slice(1, 6)
                .filter((_, i) => i % 2 === 0)
                .map(dim => Math.round(parseFloat(dim)) + "");
        }
        return dimensions.every(d => d !== "Unavailable") ? dimensions.concat(weight) : DEFAULT_PACKAGE_DATA;
    };

    // Convert value string to rounded number string, stripping unit if needed.
    const convertAndStripUnit = (value, unit) => {
        const num = parseFloat(value);
        return isNaN(num) ? "Unavailable" : Math.round(num).toString();
    };

    const calculatePackageMetrics = fetchedData => {
        let totalPackages = 0,
            heaviestWeight = 0,
            totalWeight = 0,
            longestLength = 0,
            longestPackage = null;

        for (const item of fetchedData) {
            if (!Array.isArray(item.packageData)) {
                console.error('Invalid packageData format for', item);
                continue;
            }
            let [l, h, w, weight] = item.packageData.map(d => parseInt(d, 10));
            const qty = parseInt(item.quantity, 10);
            [l, h, w] = [l, h, w].sort((a, b) => b - a);
            totalPackages += qty;
            totalWeight += weight * qty;
            if (weight > heaviestWeight) heaviestWeight = weight;
            if (l > longestLength) {
                longestLength = l;
                longestPackage = { length: l, height: h, width: w };
            }
        }
        console.log('Packages:', totalPackages, '| Heaviest:', heaviestWeight, '| Total Weight:', totalWeight);
        return { totalNumberOfPackages: totalPackages, heaviestPackageWeight: heaviestWeight, totalWeight, longestPackageLength: longestLength, longestPackage };
    };

    // -----------------------------
    // SAV & COLISWEB COOKIE / SESSION
    // -----------------------------
    let savCookie = "";
    const setSavCookie = async () => {
        const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/";
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
            "User-Agent": navigator.userAgent
        };
        try {
            console.log("Requesting SAV cookie...");
            const response = await makeCORSRequest(url, "GET", headers);
            console.log("SAV cookie response received");
            // Optionally extract and set cookie if needed
        } catch (error) {
            console.error("Error setting SAV cookie:", error);
        }
    };

    const initializeSession = async (cookie = "") => {
        const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/initAccueil.do";
        const headers = {
            "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
            "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Cookie": cookie,
            "User-Agent": navigator.userAgent,
            "X-Prototype-Version": "1.5.1.2",
            "X-Requested-With": "XMLHttpRequest"
        };
        const payload = "%2FcastoSav%2Fmain%2FinitAccueil.do&__AjaxCall__=true&_=";
        try {
            await makeCORSRequest(url, "POST", headers, payload);
            console.log("Session initialized");
        } catch (error) {
            console.error("Session initialization error:", error);
            throw error;
        }
    };

    let globalCookie = "";
    const setColiswebCookie = async () => {
        const logID = "Y2FzdG9tZXR6MDEy";
        const logPW = "Y3cxMg==";
        const url = "https://api.production.colisweb.com/api/v6/authent/external/session";
        const headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Cookie": globalCookie,
            "User-Agent": navigator.userAgent
        };
        const payload = JSON.stringify({
            username: atob(logID),
            password: atob(logPW)
        });
        try {
            const response = await makeCORSRequest(url, "POST", headers, payload);
            console.log("New Colisweb cookie response:", response);
        } catch (error) {
            console.error("Error setting Colisweb cookie:", error);
        }
    };

    // -----------------------------
    // PRODUCT & PACKAGE FETCHING
    // -----------------------------
    const fetchProductCode = async (barcode) => {
        if (hardcodedProductDetails[barcode]) {
            console.log(`Using hardcoded data for barcode ${barcode}`);
            return barcode;
        }
        const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/validRechercheProduit.do";
        const headers = {
            "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
            "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": navigator.userAgent,
            "X-Prototype-Version": "1.5.1.2",
            "X-Requested-With": "XMLHttpRequest"
        };
        const payload = `%2FcastoSav%2Fmain%2FvalidRechercheProduit.do&__FormAjaxCall__=true&filtreRechercherProduit_codeBarre=${encodeURIComponent(barcode)}&_=`; 
        // Special case for known barcode
        if (barcode === "3663602431893") return barcode;
        try {
            const responseText = await makeCORSRequest(url, "POST", headers, payload);
            if (responseText.includes("Copyright (C)")) {
                console.log("Cookie failure detected, updating SAV cookie...");
                await setSavCookie();
                window.open("http://agile.intranet.castosav.castorama.fr:8080/castoSav", "SAV_popupWindow", "width=100,height=100,scrollbars=no");
                await delay(RETRY_DELAY_MS);
                await setupCustomButtons();
                return responseText;
            } else {
                return extractProductCode(responseText);
            }
        } catch (error) {
            console.error("Error fetching product code for", barcode, error);
            return null;
        }
    };

    const fetchPackageData = async (productId, cookie = "") => {
        if (hardcodedProductDetails[productId]) {
            console.log(`Using hardcoded data for productId ${productId}`);
            return hardcodedProductDetails[productId].packageData;
        }
        const url = "http://agile.intranet.castosav.castorama.fr:8080/castoSav/main/initDetailProduit.do";
        const headers = {
            "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
            "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Cookie": cookie,
            "User-Agent": navigator.userAgent,
            "X-Prototype-Version": "1.5.1.2",
            "X-Requested-With": "XMLHttpRequest"
        };
        const payload = `%2FcastoSav%2Fmain%2FinitDetailProduit.do&__AjaxCall__=true&idProduit=${encodeURIComponent(productId)}&isGoBack=false&_=`;
        try {
            const responseText = await makeCORSRequest(url, "POST", headers, payload);
            return extractPackageData(responseText);
        } catch (error) {
            console.error("Error fetching package data for", productId, error);
            return DEFAULT_PACKAGE_DATA;
        }
    };

    // -----------------------------
    // DELIVERY OPTIONS & NOTIFICATIONS
    // -----------------------------
    const fetchDeliveryOptions = async (geocodeData, packageMetrics, postalCode, cookie) => {
        console.log("Fetching delivery options...");
        const url = "https://api.production.colisweb.com/api/v5/clients/249/stores/8481/deliveryOptions";
        const headers = {
            "Content-Type": "application/json",
            "Cookie": cookie
        };
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + 2);
        const payload = {
            startDate: now.toISOString(),
            endDate: endDate.toISOString(),
            pickupAddress: {
                latitude: 49.0750948,
                longitude: 6.1000448,
                postalCode: "57130",
                storeId: "8481",
                geocodingLevel: "streetAddress",
                administrativeArea: { name: "", code: "44", code2: "57", code3: "579", countryCode: "FR" }
            },
            shippingAddress: {
                latitude: geocodeData.latitude,
                longitude: geocodeData.longitude,
                postalCode,
                additionalInformation: { floor: null, hasLift: "maybe_lift" },
                geocodingLevel: "streetAddress",
                administrativeArea: { name: "Grand Est", code: "44", code2: "57", code3: "579", countryCode: "FR" }
            },
            packaging: {
                numberOfPackets: packageMetrics.totalNumberOfPackages,
                heightCm: packageMetrics.longestPackage?.height,
                lengthCm: packageMetrics.longestPackage?.length,
                widthCm: packageMetrics.longestPackage?.width,
                weightKg: packageMetrics.totalWeight,
                maxPacketWeightKg: packageMetrics.heaviestPackageWeight,
                maxPacketLengthCm: packageMetrics.longestPackageLength
            },
            requiredSkills: ["sidewalkdelivery"]
        };

        try {
            const responseText = await makeCORSRequest(url, "POST", headers, JSON.stringify(payload));
            const responseJson = JSON.parse(responseText);
            if (responseJson.code && responseJson.code.includes('EXPIRED') ||
                responseJson.exp?.includes("expired") || responseJson.message?.includes("Unauthorized")) {
                LoaderManager.hide();
                console.log("Session expired");
                return responseJson;
            } else if (responseJson.code && responseJson.code.includes('LOAD')) {
                LoaderManager.hide();
                notification("alert", "Aucune offre coliweb compatible pour cette commande, faites une demande de devis via le formulaire.");
                throw new Error("Pas d'offre coliweb");
            } else if (responseJson.error && responseJson.error.includes('distance')) {
                LoaderManager.hide();
                notification("alert", "Pas d'offres existantes à cette distance.");
                throw new Error("Distance non couverte");
            } else if (responseJson.error && responseJson.error.includes('heavy')) {
                LoaderManager.hide();
                notification("alert", "Commande trop lourde pour Coliweb, faites une demande de devis via le formulaire.");
                return "heavy";
            } else if (responseJson.calendar && responseJson.calendar.length > 0) {
                const priceWithTaxes = responseJson.calendar[0].priceWithTaxes;
                const adjustedPrice = priceWithTaxes * 1.0376;
                const roundedPrice = parseFloat(adjustedPrice.toFixed(2));
                LoaderManager.hide();
                notification("", "Prix livraison: " + roundedPrice + " €");
                return priceWithTaxes;
            } else {
                LoaderManager.hide();
                alert("No price data available");
                return null;
            }
        } catch (error) {
            console.error("Delivery options error:", error);
            LoaderManager.hide();
            return "Erreur inconnue";
        }
    };

    let notificationsCount = 0;
    let lastNotificationBottom = 0;
    let CW_popupWindow = null;
    const notification = (type, message, linkText = "", linkURL = "") => {
        const notif = document.createElement("div");
        notif.innerText = message;
        Object.assign(notif.style, {
            position: "fixed",
            left: "50%",
            backgroundColor: type === "alert" ? "linear-gradient(to right, rgba(175,76,76), rgba(157,68,68))" : "#0078d7",
            color: "white",
            padding: "15px 30px",
            borderRadius: "30px",
            boxShadow: "0 0px 1px rgba(0,0,0,0.2)",
            zIndex: "1000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            font: 'bold 1em / 1.25 Arial, Helvetica, sans-serif',
            fontSize: "110%",
            transition: "all 0.5s ease-in-out",
            opacity: "0",
            transform: "translate(-50%, -100%) scale(0)"
        });
        document.body.appendChild(notif);
        notificationsCount++;

        // Position notification
        if (lastNotificationBottom === 0) {
            notif.style.top = "50%";
        } else {
            notif.style.top = `${lastNotificationBottom + 50}px`;
        }
        setTimeout(() => {
            notif.style.opacity = "1";
            notif.style.transform = "translate(-50%, -50%) scale(1)";
            lastNotificationBottom = notif.getBoundingClientRect().bottom;
        }, 10);

        if (linkText && linkURL) {
            const link = document.createElement("a");
            link.href = linkURL;
            link.innerText = ` ${linkText}`;
            link.style.color = "#ffff00";
            link.style.textDecoration = "underline";
            link.addEventListener("click", e => {
                e.preventDefault();
                CW_popupWindow = window.open(linkURL, "CW_popupWindow", "width=400,height=400,scrollbars=no");
            });
            notif.appendChild(link);
        }
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                notif.remove();
                notificationsCount--;
                if (notificationsCount === 0) lastNotificationBottom = 0;
            }, 600);
        }, 5000);
    };

    // -----------------------------
    // GM STORAGE MANAGEMENT
    // -----------------------------
    let deliveryDetails = {};
    const clearAndSetGMValues = async () => {
        const keys = await GM.listValues();
        console.log("Clearing GM values:", keys);
        keys.forEach(key => GM.deleteValue(key));
        deliveryDetails.lastUpdated = new Date().toISOString();
        await GM.setValue("deliveryDetails", JSON.stringify(deliveryDetails));
        console.log("Stored delivery details:", JSON.stringify(deliveryDetails));
        const storedJSON = await GM.getValue("deliveryDetails");
        const storedData = JSON.parse(storedJSON);
        if (storedData && storedData.lastUpdated === deliveryDetails.lastUpdated) {
            console.log("GM storage validated.");
        } else {
            console.error("GM storage validation failed.");
        }
    };

    // -----------------------------
    // BUTTONS & UI SETUP
    // -----------------------------
    let estimateButton, deliveryButton;
    const createButton = ({ id, textContent, styles, onClick }) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = textContent;
        Object.assign(btn.style, {
            zIndex: '1000',
            position: 'relative',
            backgroundColor: '#0078d7',
            borderRadius: '5px',
            border: '1px solid #005cca',
            color: '#fff',
            display: 'inline-block',
            padding: '7px 10px',
            height: '30px',
            cursor: 'pointer',
            margin: '0',
            font: 'bold 1em / 1.25 Arial,Helvetica,sans-serif',
            whiteSpace: 'nowrap',
            ...styles
        });
        btn.addEventListener('click', onClick);
        btn.addEventListener("mouseover", function() {
            this.style.backgroundColor = "#005CE6";
        });
        btn.addEventListener("mouseout", function() {
            this.style.backgroundColor = "#0078d7";
        });
        return btn;
    };

    const setupCustomButtons = () => {
        estimateButton = createButton({
            id: 'Estimer-livraison',
            textContent: 'Estimer prix Colisweb',
            styles: { marginLeft: '48px', width: '148px' },
            onClick: EstimerButtonAction
        });
        deliveryButton = createButton({
            id: 'programmer-la-livraison',
            textContent: 'Programmer la livraison',
            styles: { marginLeft: '38px', marginTop: '10px', display: 'none' },
            onClick: () => window.open('https://bo.production.colisweb.com/store/clients/249/stores/8481/create-delivery', '_blank')
        });
        const container = document.querySelector('.ui-row.col-80-20.basket .secondary-col');
        if (container && !document.getElementById('Estimer-livraison')) {
            const checkoutBtn = container.querySelector('.js-proceed-checkout-btn');
            container.insertBefore(estimateButton, checkoutBtn);
            container.insertBefore(deliveryButton, estimateButton.nextSibling);
            console.log('Custom buttons added.');
        }
        // Observe mutations to add buttons if container appears later
        const observer = new MutationObserver(() => {
            if (document.querySelector('.ui-row.col-80-20.basket .secondary-col') &&
                document.querySelector('.js-proceed-checkout-btn') &&
                !document.getElementById('Estimer-livraison')) {
                setupCustomButtons();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // -----------------------------
    // MAIN ACTION: ESTIMATE & DELIVERY
    // -----------------------------
    const EstimerButtonAction = async () => {
        LoaderManager.show();
        if (estimateButton) estimateButton.textContent = 'Calcul en cours...';
        try {
            const productData = fetchEANsAndQuantities();
            const { address, postalCode } = fetchClientAddress();
            const { firstName, name, phone } = fetchClientInfos();
            const geocodeData = await fetchGeocodeData(address);
            if (geocodeData && postalCode) {
                await onLivraisonButtonPress(
                    productData.map(item => item.ean),
                    geocodeData,
                    postalCode,
                    firstName,
                    name,
                    phone,
                    address
                );
            } else {
                console.error("Missing data for delivery options.");
            }
        } catch (error) {
            console.error("Estimation error:", error);
        }
    };

    const onLivraisonButtonPress = async (eans, geocodeData, postalCode, firstName, lastName, phone, address) => {
        try {
            await initializeSession();
            const productDataWithQuantities = fetchEANsAndQuantities();
            let fetchedProductData = [];
            for (const ean of eans) {
                if (hardcodedProductDetails[ean]) {
                    const packageData = hardcodedProductDetails[ean].packageData;
                    const qty = productDataWithQuantities.find(item => item.ean === ean)?.quantity || '1';
                    fetchedProductData.push({ ean, packageData, quantity: qty });
                } else {
                    const productCode = await fetchProductCode(ean);
                    if (productCode) {
                        const packageData = await fetchPackageData(productCode);
                        if (packageData) {
                            const qty = productDataWithQuantities.find(item => item.ean === ean)?.quantity || '0';
                            fetchedProductData.push({ packageData, quantity: qty });
                            console.log("Fetched package data for", ean, ":", packageData);
                        }
                    } else {
                        console.error(`Article with EAN ${ean} not found in SAV portal.`);
                        notification("alert", `Erreur : article avec EAN ${ean} inexistant sur le portail SAV.`);
                    }
                }
            }
            const packageMetrics = calculatePackageMetrics(fetchedProductData);
            let response = await fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie);
            if (response?.exp?.includes("expired") || response?.message?.includes("Unauthorized")) {
                console.log("Colisweb session expired, updating cookie...");
                await setColiswebCookie();
                response = await fetchDeliveryOptions(geocodeData, packageMetrics, postalCode, globalCookie);
            } else if (["heavy", "distance"].includes(response)) {
                console.log("Soft exit with response:", response);
                return;
            } else if (response) {
                deliveryDetails = {
                    address: address || fetchClientAddress().address || "Info manquante",
                    packageMetrics,
                    postalCode: postalCode || "Info manquante",
                    firstName: firstName || fetchClientInfos().firstName,
                    name: lastName || fetchClientInfos().name,
                    phone: phone || fetchClientInfos().phone,
                };
                await clearAndSetGMValues();
                if (deliveryButton) deliveryButton.style.display = 'inline-block';
                if (estimateButton) estimateButton.textContent = 'Estimer prix Colisweb';
            } else {
                console.error("Failed to fetch delivery options.");
                LoaderManager.hide();
                notification("alert", "Veuillez vous reconnecter à Colisweb", "Cliquez ici", "https://bo.production.colisweb.com/login");
                if (estimateButton) estimateButton.textContent = 'Estimer prix Colisweb';
            }
        } catch (error) {
            if (estimateButton) estimateButton.textContent = 'Estimer prix Colisweb';
            console.error("Error during livraison processing:", error);
            notification("alert", "Calcul impossible. " + error);
            LoaderManager.hide();
        }
    };

    // -----------------------------
    // LOGIN & AUTO-FILL FUNCTIONS (Script 2 & 3)
    // -----------------------------
    const autoFill = async (selector, value) => {
        let inputField;
        do {
            await delay(DELAY_MS);
            inputField = document.querySelector(selector);
        } while (!inputField || !isElementVisible(inputField));
        console.log(`${selector} found. Setting value.`);
        inputField.setAttribute('placeholder', value);
    };

    const closePopup = keyword => {
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (url.includes(keyword)) {
                this.addEventListener('load', function() {
                    if (this.status === 200) {
                        console.log("Popup close trigger received.");
                        window.close();
                    }
                });
            }
            origOpen.apply(this, arguments);
        };
    };

    const fetchDeliveryDetails = async () => {
        const stored = await GM.getValue("deliveryDetails", "{}");
        try {
            deliveryDetails = JSON.parse(stored);
            console.log("Fetched delivery details:", deliveryDetails);
            return deliveryDetails;
        } catch (e) {
            console.error("Error parsing delivery details:", e);
            return {};
        }
    };

    const fillAddress = async () => {
        if (deliveryDetails.address) {
            let addressInput;
            do {
                addressInput = document.querySelector('[id^="headlessui-combobox-input-"]');
                await delay(50);
            } while (!addressInput);
            if (addressInput) {
                console.log("Address input found.");
                addressInput.value = deliveryDetails.address;
            } else {
                console.error("Address input not found.");
            }
        }
    };

    const autoPlaceHolder = async (selector, value) => {
        let inputField;
        do {
            await delay(DELAY_MS);
            inputField = document.querySelector(selector);
        } while (!inputField || !isElementVisible(inputField));
        console.log(`${selector} is visible. Setting placeholder.`);
        inputField.setAttribute('placeholder', value);
    };

    // Example boolean highlighter functions (for height/width) would be kept as in your original code.
    // You can refactor these similarly if needed.

    const execution2 = async () => {
        console.log("Executing login autofill (script 2)...");
        autoFill("#username", atob("Y2FzdG9tZXR6MDEy"));
        autoFill("#Password", atob("Y3cxMg=="));
        closePopup('external');
    };

    const execution3 = async () => {
        console.log("Executing Colisweb autofill (script 3)...");
        const details = await fetchDeliveryDetails();
        await fillAddress();
        autoPlaceHolder("#recipientFirstName", details.firstName?.toString() || "");
        autoPlaceHolder("#recipientLastName", details.name?.toString() || "");
        autoPlaceHolder("#phone1", details.phone?.toString() || "");
        autoPlaceHolder("#packagesQuantity", details.packageMetrics?.totalNumberOfPackages?.toString() || "");
        autoPlaceHolder("#heaviest", details.packageMetrics?.heaviestPackageWeight?.toString() || "");
        autoPlaceHolder("#totalWeight", details.packageMetrics?.totalWeight?.toString() || "");
        autoPlaceHolder("#longest", details.packageMetrics?.longestPackage?.length?.toString() || "");
        autoPlaceHolder("#length", details.packageMetrics?.longestPackage?.length?.toString() || "");
        // Call your highlightBooleanHeight/Width functions if defined
    };

    const execution4 = async () => {
        await delay(0);
        closePopup("initAccueil.do");
    };

    // -----------------------------
    // MAIN EXECUTION
    // -----------------------------
    (async function main() {
        const domain = window.location.hostname;
        const path = window.location.pathname;
        if (domain === "prod-agent.castorama.fr") {
            // Script 1: Main process
            const prodResponse = await fetchProductCode("3663602942986");
            if (prodResponse && !prodResponse.includes("Copyright (C)")) {
                await setupCustomButtons();
                console.log("SAV cookie properly set.");
            } else {
                console.error("SAV cookie initialization error.");
            }
            setInterval(() => initializeSession(), 300000);
        } else if (path.includes("/login")) {
            await execution2();
        } else if (path.includes("create-delivery")) {
            await execution3();
        } else if (domain.includes("agile.intranet.castosav.castorama.fr:8080") && path.includes("castoSav")) {
            await execution4();
        }
    })();
})();

