// ==UserScript==
// @name         Coliweb Livraison Calculator (Refactored)
// @namespace    cstrm.scripts/colisweb-refactored
// @version      2.0.0 // Updated version number for major refactor
// @description  Calculates Colisweb delivery costs and autofills the Colisweb form based on Castorama basket data.
// @author       Arnaud D. (Original), Refactored by AI
// @match        http://agile.intranet.castosav.castorama.fr:8080/*
// @match        https://*.castorama.fr/store/*/checkout/multi/delivery-address/add*
// @match        https://*.castorama.fr/store/*/checkout/multi/billing-address/add*
// @match        https://*.castorama.fr/store/*/checkout/multi/choose-delivery-option*
// @match        https://*.castorama.fr/checkout/reviewAndPay*
// @match        https://*.castorama.fr/basket* // Match basket page specifically
// @match        https://bo.production.colisweb.com/login*
// @match        https://bo.production.colisweb.com/store/clients/249/stores/8481/create-delivery*
// @exclude      https://www.castorama.fr/ // Exclude homepage explicitly
// @connect      agile.intranet.castosav.castorama.fr // Allow connection to SAV
// @connect      api.production.colisweb.com // Allow connection to Colisweb API
// @connect      geocode.maps.co // Allow connection to Geocoding API
// @connect      * // Keep wildcard for potential future needs or missed domains, though specific is better
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @run-at       document-idle
// @downloadURL  https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery_refactored.user.js // Suggest different name
// @updateURL    https://github.com/ArildWaldan/CWAutoDelivery/raw/main/coliswebAutoDelivery_refactored.user.js // Suggest different name
// @icon         https://www.google.com/s2/favicons?sz=64&domain=castorama.fr // Add an icon
// ==/UserScript==

/* eslint-env browser, greasemonkey */
/* eslint-disable no-unused-vars, no-console */ // Basic ESLint directives

(function main() {
    'use strict';

    // --- Constants and Configuration ---

    const SCRIPT_NAME = 'Coliweb Livraison Calculator';
    const DEBUG_MODE = true; // Set to false for production to reduce console noise

    const CONFIG = {
        // URLs
        savBaseUrl: "http://agile.intranet.castosav.castorama.fr:8080/castoSav",
        savInitUrl: "/main/initAccueil.do",
        savSearchUrl: "/main/validRechercheProduit.do",
        savDetailUrl: "/main/initDetailProduit.do",
        coliswebApiBaseUrl: "https://api.production.colisweb.com/api",
        coliswebLoginUrl: "/v6/authent/external/session",
        coliswebOptionsUrl: "/v5/clients/249/stores/8481/deliveryOptions",
        coliswebCreateDeliveryUrl: "https://bo.production.colisweb.com/store/clients/249/stores/8481/create-delivery",
        coliswebLoginRedirectUrl: "https://bo.production.colisweb.com/login",
        coliswebQuoteUrl: "https://bo.production.colisweb.com/store/clients/249/stores/8481/quotation",
        geocodeApiUrl: "https://geocode.maps.co/search",
        // API Keys & Credentials (Consider security implications - these are visible in the script)
        geocodeApiKey: "65ae97aa4417a328160769gcb8adb4f", // Public free key, likely okay
        coliswebUsername: atob("Y2FzdG9tZXR6MDEy"), // "castometz012"
        coliswebPassword: atob("Y3cxMg=="), // "cw12"
        // Selectors (Castorama Basket/Checkout)
        eanSelector: '.js-ean-val',
        quantitySelector: '.js-basket-qty-change',
        deliveryAddressSelector: '.js-saved-delivery-address .accord-content .panel-inner .cust-del-add-col1 dd address',
        billingAddressSelector: '.accord-content .panel-inner .cust-del-add-col1 dd address', // Fallback
        clientNameSelector: '.col1.cust-del-add-col1 dl.definition-desc-inline dd',
        clientPhoneFixedSelector: '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(1)',
        clientPhoneMobileSelector: '.col2.cust-del-add-col2 dl.definition-desc-inline dd:nth-of-type(2)',
        checkoutButtonContainerSelector: '.ui-row.col-80-20.basket .secondary-col',
        checkoutProceedButtonSelector: '.js-proceed-checkout-btn',
        // Selectors (Colisweb Autofill)
        coliswebUsernameSelector: "#username",
        coliswebPasswordSelector: "#Password",
        coliswebAddressInputSelector: '[id^="headlessui-combobox-input-"]',
        coliswebAddressOptionSelector: '[id^="headlessui-combobox-option-"]',
        coliswebFirstNameSelector: "#recipientFirstName",
        coliswebLastNameSelector: "#recipientLastName",
        coliswebPhoneSelector: "#phone1",
        coliswebPackagesQtySelector: "#packagesQuantity",
        coliswebHeaviestPkgSelector: "#heaviest", // Assumed, original script used #weight too, clarify if different
        coliswebTotalWeightSelector: "#totalWeight",
        coliswebLongestPkgSelector: "#longest", // Assumed, original script used #length too, clarify if different
        // Selectors (Colisweb Highlight - Use more robust selectors if possible)
        coliswebHeightLt150Selector: ".lessThan150", // Simplified, assuming these classes exist uniquely
        coliswebHeight150to180Selector: ".between150And180",
        coliswebHeightGt180Selector: ".moreThan180",
        coliswebWidthLtEq50Selector: ".lessThanOrEqualTo50",
        coliswebWidthGt50Selector: ".moreThan50",
        // Other Config
        coliswebPriceMargin: 1.0376,
        geocodeRetryDelayMs: 1050, // Delay between geocode attempts
        sessionInitIntervalMs: 300000, // 5 minutes
        notificationTimeoutMs: 15000, // 15 seconds for alerts
        gmStorageKey: "coliswebDeliveryDetails_v2", // Use a versioned key
        pickupLocation: { // Castorama Metz location
            latitude: 49.0750948,
            longitude: 6.1000448,
            postalCode: "57130",
            storeId: "8481"
        },
        // Hardcoded product data (Exceptions)
        hardcodedProductDetails: {
            "3663602431893": {
                packageData: ["15", "15", "40", "2.5"], // L, W, H (cm), Weight (kg) - Ensure order is consistent
                description: "Neva Platine"
            }
            // Add more EANs here if necessary
        }
    };

    // --- Global State ---

    // Use GM storage for persistent state across page loads/scripts
    // In-memory state for current page execution
    let state = {
        estimateButton: null,
        deliveryButton: null,
        savPopupWindow: null,
        cwPopupWindow: null,
        savSessionInitialized: false,
        notificationQueue: [],
        isProcessingNotifications: false,
        notificationContainer: null,
        notificationOverlay: null,
        notificationCount: 0,
    };

    // --- Logging Utility ---

    const logger = {
        log: (...args) => DEBUG_MODE && console.log(`[${SCRIPT_NAME}]`, ...args),
        warn: (...args) => console.warn(`[${SCRIPT_NAME}]`, ...args),
        error: (...args) => console.error(`[${SCRIPT_NAME}]`, ...args),
    };

    // --- Utility Functions ---

    /**
     * Delays execution for a specified number of milliseconds.
     * @param {number} ms - The delay duration in milliseconds.
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Checks if a DOM element is currently visible to the user.
     * @param {Element|null} element - The DOM element to check.
     * @returns {boolean} True if the element is visible, false otherwise.
     */
    function isElementVisible(element) {
        return element && element.offsetParent !== null && window.getComputedStyle(element).display !== 'none' && window.getComputedStyle(element).visibility !== 'hidden';
    }

    /**
     * Makes a CORS-compliant request using GM_xmlhttpRequest.
     * @param {string} url - The URL to request.
     * @param {string} method - The HTTP method (GET, POST, etc.).
     * @param {object} [headers={}] - Request headers.
     * @param {string|object|null} [payload=null] - Request body data.
     * @param {'text'|'json'|'blob'|'arraybuffer'} [responseType='text'] - Expected response type.
     * @returns {Promise<any>} Resolves with the response data or rejects with an error.
     */
    async function makeCORSRequest(url, method, headers = {}, payload = null, responseType = 'text') {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers,
                data: payload instanceof Object && !(payload instanceof FormData) ? JSON.stringify(payload) : payload,
                responseType: responseType === 'json' ? 'text' : responseType, // Request as text for manual JSON parsing
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            if (responseType === 'json') {
                                resolve(JSON.parse(response.responseText));
                            } else {
                                resolve(response.responseText);
                            }
                        } catch (parseError) {
                            logger.error("JSON parsing error:", parseError, "Response text:", response.responseText.substring(0, 500));
                            reject(new Error(`Failed to parse JSON response from ${url}`));
                        }
                    } else {
                        logger.error(`HTTP error ${response.status} for ${url}:`, response.statusText, response.responseText.substring(0, 500));
                        reject(new Error(`HTTP error ${response.status}: ${response.statusText} for ${url}`));
                    }
                },
                onerror: (error) => {
                    logger.error(`Network error requesting ${url}:`, error);
                    reject(new Error(`Network error requesting ${url}: ${error.error || 'Unknown error'}`));
                },
                ontimeout: () => {
                    logger.error(`Request timed out for ${url}`);
                    reject(new Error(`Request timed out for ${url}`));
                }
            });
        });
    }

    // --- Loader Management ---

    const LoaderManager = {
        loaderElement: null,
        init: function() {
            this.injectCSS();
            this.injectLoaderHTML();
            this.loaderElement = document.getElementById('tmLoader');
        },
        injectLoaderHTML: function() {
            if (document.getElementById('tmLoader')) return;
            const loaderHTML = `
                <div id="tmLoader" class="tm-loader" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;"></div>
            `;
            document.body.insertAdjacentHTML('beforeend', loaderHTML);
        },
        injectCSS: function() {
            if (document.getElementById('tmLoaderCSS')) return;
            const css = `
                .tm-loader {
                    height: 5px; width: 5px; color: #3498db;
                    box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px;
                    animation: tm-loader-anim 6s infinite;
                }
                @keyframes tm-loader-anim {
                    0%   { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
                    8.33%{ box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px -10px 0 5px,  10px -10px 0 5px; }
                    16.66%{ box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px; }
                    24.99%{ box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
                    33.32%{ box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px -10px 0 5px; } /* Corrected */
                    41.65%{ box-shadow:  10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px,  10px -10px 0 5px; } /* Corrected */
                    49.98%{ box-shadow:  10px  10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px; }
                    58.31%{ box-shadow: -10px  10px 0 5px, -10px  10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
                    66.64%{ box-shadow: -10px -10px 0 5px, -10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
                    74.97%{ box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; } /* Re-added for symmetry */
                    83.3% { box-shadow: -10px -10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; } /* Corrected */
                    91.63%{ box-shadow: -10px -10px 0 5px, -10px  10px 0 5px, -10px  10px 0 5px, -10px  10px 0 5px; } /* Corrected */
                    100% { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.id = "tmLoaderCSS";
            styleSheet.type = "text/css";
            styleSheet.innerText = css;
            document.head.appendChild(styleSheet);
        },
        show: function() {
            if (!this.loaderElement) this.init();
            if (this.loaderElement) this.loaderElement.style.display = 'block';
            logger.log("Loader shown");
        },
        hide: function() {
            if (this.loaderElement) this.loaderElement.style.display = 'none';
            logger.log("Loader hidden");
        }
    };

    // --- Notification System ---

    const NotificationManager = {
        createContainer: function() {
            if (!state.notificationContainer) {
                state.notificationContainer = document.createElement("div");
                state.notificationContainer.id = "tm-notification-container";
                Object.assign(state.notificationContainer.style, {
                    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    display: "flex", flexDirection: "column", gap: "10px",
                    maxHeight: "80vh", maxWidth: "90vw", overflowY: "auto", zIndex: "10001" // Above overlay
                });
                document.body.appendChild(state.notificationContainer);
            }
        },
        addOverlay: function() {
            if (!state.notificationOverlay) {
                state.notificationOverlay = document.createElement("div");
                state.notificationOverlay.id = "tm-notification-overlay";
                Object.assign(state.notificationOverlay.style, {
                    position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
                    backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: "10000"
                });
                state.notificationOverlay.addEventListener('click', this.removeAll);
                document.body.appendChild(state.notificationOverlay);
            }
        },
        removeOverlay: function() {
            if (state.notificationOverlay) {
                state.notificationOverlay.removeEventListener('click', this.removeAll);
                state.notificationOverlay.remove();
                state.notificationOverlay = null;
            }
        },
        processQueue: function() {
            if (state.isProcessingNotifications || state.notificationQueue.length === 0) return;
            state.isProcessingNotifications = true;
            const notificationData = state.notificationQueue.shift();
            this._show(notificationData);
            // Delay slightly before processing next to allow animations/visibility
            setTimeout(() => {
                state.isProcessingNotifications = false;
                this.processQueue();
            }, 350);
        },
        notify: function(type, message, options = {}) {
            // Options: { details: object|string, linkText: string, linkUrl: string, autoDismiss: boolean }
            this.createContainer();
            state.notificationQueue.push({ type, message, ...options });
            if (!state.isProcessingNotifications) {
                this.processQueue();
            }
        },
        _show: function({ type, message, details = null, linkText = null, linkUrl = null, autoDismiss = (type === 'alert') }) {
            if (!state.notificationContainer) this.createContainer(); // Ensure container exists

            const notification = document.createElement("div");
            notification.className = "tm-notification";
            Object.assign(notification.style, {
                backgroundColor: type === "alert" ? "#f44336" : "#0078d7", color: "white",
                padding: "15px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                width: "350px", maxWidth: "100%", position: "relative", opacity: "0",
                transform: "scale(0.95)", transition: "all 0.3s ease-out"
            });

            // Header (Title + Close Button)
            const header = document.createElement("div");
            Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" });

            const title = document.createElement("div");
            Object.assign(title.style, { fontWeight: "bold", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" });
            const icon = document.createElement("span");
            icon.innerHTML = type === "alert"
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
            title.appendChild(icon);
            title.appendChild(document.createTextNode(type === "alert" ? "Alerte" : "Information"));
            header.appendChild(title);

            const closeBtn = document.createElement("button");
            Object.assign(closeBtn.style, { background: "transparent", border: "none", color: "white", cursor: "pointer", padding: "0", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" });
            closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            closeBtn.addEventListener("click", () => this.remove(notification));
            header.appendChild(closeBtn);
            notification.appendChild(header);

            // Content
            const content = document.createElement("div");
            Object.assign(content.style, { marginBottom: details || linkText ? "10px" : "0", lineHeight: "1.4", wordBreak: "break-word" });
            content.textContent = message;
            notification.appendChild(content);

            // Details
            if (details) {
                const detailsContainer = document.createElement("div");
                Object.assign(detailsContainer.style, { marginTop: "10px", fontSize: "14px", backgroundColor: "rgba(255, 255, 255, 0.1)", padding: "10px", borderRadius: "4px" });
                if (typeof details === 'object') {
                    for (const [key, value] of Object.entries(details)) {
                        const item = document.createElement("div");
                        item.style.marginBottom = "5px";
                        item.innerHTML = `<span style="font-weight:bold; margin-right: 5px;">${key}:</span><span>${value}</span>`;
                        detailsContainer.appendChild(item);
                    }
                } else {
                    detailsContainer.textContent = details;
                }
                notification.appendChild(detailsContainer);
            }

            // Link
            if (linkText && linkUrl) {
                const linkContainer = document.createElement("div");
                linkContainer.style.marginTop = "10px";
                const link = document.createElement("a");
                link.href = linkUrl;
                link.textContent = linkText;
                Object.assign(link.style, { color: "#ffffff", textDecoration: "underline", display: "inline-block", padding: "5px 10px", backgroundColor: "rgba(255, 255, 255, 0.15)", borderRadius: "4px", transition: "background-color 0.2s" });
                link.addEventListener("mouseover", () => link.style.backgroundColor = "rgba(255, 255, 255, 0.25)");
                link.addEventListener("mouseout", () => link.style.backgroundColor = "rgba(255, 255, 255, 0.15)");
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    window.open(linkUrl, "CW_LinkPopup", "width=800,height=600,scrollbars=yes,resizable=yes");
                });
                linkContainer.appendChild(link);
                notification.appendChild(linkContainer);
            }

            state.notificationContainer.appendChild(notification);
            state.notificationCount++;
            if (state.notificationCount > 0) this.addOverlay(); // Show overlay if any notification is visible

            // Animate in
            requestAnimationFrame(() => {
                notification.style.opacity = "1";
                notification.style.transform = "scale(1)";
            });

            // Auto-dismiss
            if (autoDismiss) {
                setTimeout(() => this.remove(notification), CONFIG.notificationTimeoutMs);
            }
        },
        remove: function(notification) {
            if (!notification || !notification.parentNode) return; // Already removed or invalid

            notification.style.opacity = "0";
            notification.style.transform = "scale(0.95)";

            setTimeout(() => {
                if (notification.parentNode) { // Check again before removal
                     notification.remove();
                     state.notificationCount--;
                     if (state.notificationCount <= 0) {
                        this.removeOverlay();
                        if (state.notificationContainer) {
                            state.notificationContainer.remove();
                            state.notificationContainer = null;
                        }
                        state.notificationCount = 0; // Reset count
                    }
                }
            }, 300); // Match transition duration
        },
        removeAll: function() {
            if (state.notificationContainer) {
                Array.from(state.notificationContainer.children).forEach(notification => NotificationManager.remove(notification));
            }
            // The remove function handles overlay/container cleanup when count reaches 0
        },
        showQuote: function(priceWithTaxes, packageMetrics, failedEANs = []) {
            const adjustedPrice = priceWithTaxes * CONFIG.coliswebPriceMargin;
            const roundedPrice = parseFloat(adjustedPrice.toFixed(2));

            const details = {
                "Prix Colisweb (HT)": priceWithTaxes.toFixed(2) + " €",
                "Prix Facturé Client (TTC*)": roundedPrice + " €",
                "Nombre de colis": packageMetrics.totalPackages,
                "Poids total": packageMetrics.totalWeightKg + " kg",
                "Colis le + lourd": packageMetrics.maxPackageWeightKg + " kg",
                "Colis le + long (L×l×H)": `${packageMetrics.longestPackageDims?.length ?? 'N/A'}×${packageMetrics.longestPackageDims?.width ?? 'N/A'}×${packageMetrics.longestPackageDims?.height ?? 'N/A'} cm`,
                "*": `Prix HT × ${CONFIG.coliswebPriceMargin.toFixed(4)}`,
            };

            if (failedEANs.length > 0) {
                details["EANs non traités"] = failedEANs.join(", ");
                this.notify("alert", `Certains articles n'ont pas pu être traités (EANs: ${failedEANs.join(", ")}). Le prix est basé sur les articles restants.`);
            }

             this.notify("info", `Estimation Colisweb : ${roundedPrice} €`, { details });
        }
    };

    // --- Data Storage ---

    const StorageManager = {
        key: CONFIG.gmStorageKey,
        async save(data) {
            try {
                const dataToStore = { ...data, lastUpdated: new Date().toISOString() };
                await GM.setValue(this.key, JSON.stringify(dataToStore));
                logger.log("Delivery details saved:", dataToStore);
                return true;
            } catch (error) {
                logger.error("Error saving data to GM storage:", error);
                NotificationManager.notify("alert", "Erreur interne: Impossible de sauvegarder les détails de livraison.");
                return false;
            }
        },
        async load() {
            try {
                const storedData = await GM.getValue(this.key, null);
                if (storedData) {
                    const parsedData = JSON.parse(storedData);
                    logger.log("Delivery details loaded:", parsedData);
                    return parsedData;
                }
                logger.log("No delivery details found in storage.");
                return null;
            } catch (error) {
                logger.error("Error loading data from GM storage:", error);
                // Optionally clear potentially corrupted data
                // await GM.deleteValue(this.key);
                return null;
            }
        },
        async clear() {
            try {
                await GM.deleteValue(this.key);
                logger.log("Delivery details cleared from storage.");
            } catch (error) {
                logger.error("Error clearing data from GM storage:", error);
            }
        },
         // Utility to clear ALL script data (use with caution)
         async clearAllScriptData() {
            try {
                const keys = await GM.listValues();
                const scriptKeys = keys.filter(k => k.startsWith('coliswebDeliveryDetails')); // Adjust prefix if needed
                if (scriptKeys.length > 0) {
                    await Promise.all(scriptKeys.map(key => GM.deleteValue(key)));
                    logger.log(`Cleared ${scriptKeys.length} storage keys:`, scriptKeys);
                } else {
                    logger.log("No script-related storage keys found to clear.");
                }
            } catch (error) {
                logger.error("Error clearing all script data:", error);
            }
        }
    };

    // --- Castorama Data Extraction ---

    const CastoDataExtractor = {
        /**
         * Fetches EANs and quantities from the basket.
         * @returns {Array<{ean: string, quantity: string}>}
         */
        fetchEANsAndQuantities: function() {
            const productData = [];
            const eanElements = document.querySelectorAll(CONFIG.eanSelector);
            eanElements.forEach(eanElement => {
                const ean = eanElement?.textContent?.trim();
                if (!ean) return; // Skip if no EAN found
                const row = eanElement.closest('tr'); // Assumes EAN and quantity are in the same table row
                const quantityInput = row?.querySelector(CONFIG.quantitySelector);
                const quantity = quantityInput?.value?.trim() || '1'; // Default to 1 if quantity not found/invalid
                productData.push({ ean, quantity: parseInt(quantity, 10) || 1 });
            });
            logger.log("Fetched EANs and Quantities:", productData);
            if (productData.length === 0) {
                 NotificationManager.notify("alert", "Aucun article trouvé dans le panier.");
            }
            return productData;
        },

        /**
         * Fetches the client's delivery or billing address and postal code.
         * @returns {{address: string, postalCode: string}|null} Returns address object or null if not found/valid.
         */
        fetchClientAddress: function() {
            let addressElement = document.querySelector(CONFIG.deliveryAddressSelector);
            if (!addressElement || !addressElement.textContent?.trim()) {
                addressElement = document.querySelector(CONFIG.billingAddressSelector);
            }

            if (!addressElement || !addressElement.textContent?.trim()) {
                logger.warn("Client address not found.");
                NotificationManager.notify("alert", "Adresse client non trouvée. Vérifiez les informations de livraison/facturation.");
                return null;
            }

            // Clean address: remove excessive whitespace/newlines
            const rawAddress = addressElement.textContent.trim();
            const address = rawAddress.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

            // Extract 5-digit postal code
            const postalCodeMatch = address.match(/\b(\d{5})\b/);
            const postalCode = postalCodeMatch ? postalCodeMatch[1] : null;

            if (!postalCode) {
                logger.warn("Postal code not found in address:", address);
                NotificationManager.notify("alert", `Code postal non trouvé dans l'adresse : "${address}". Vérifiez le format.`);
                return null;
            }

            logger.log("Fetched Client Address:", address, "Postal Code:", postalCode);
            return { address, postalCode };
        },

        /**
         * Fetches the client's name and phone number.
         * @returns {{firstName: string, lastName: string, phone: string}}
         */
        fetchClientInfos: function() {
            const nameElement = document.querySelector(CONFIG.clientNameSelector);
            const phoneFixedElement = document.querySelector(CONFIG.clientPhoneFixedSelector);
            const phoneMobileElement = document.querySelector(CONFIG.clientPhoneMobileSelector);

            let fullName = nameElement?.textContent?.trim().replace(/\s+/g, ' ') || '';
            // Remove title prefix (M., Mme, Mlle) - case-insensitive
            fullName = fullName.replace(/^(M\.|Mme|Mlle)\s*/i, '');

            let firstName = '';
            let lastName = '';
            const nameParts = fullName.split(' ').filter(part => part); // Split and remove empty parts

            if (nameParts.length > 1) {
                // Common French order: LASTNAME Firstname(s)
                 lastName = nameParts[0];
                 firstName = nameParts.slice(1).join(' ');
                // // OR Assume Firstname Lastname order (adjust if needed)
                // firstName = nameParts[0];
                // lastName = nameParts.slice(1).join(' ');
            } else if (nameParts.length === 1) {
                lastName = nameParts[0]; // Assume it's the last name if only one part
                firstName = ''; // Or maybe set firstName = lastName? Depends on Colisweb reqs.
            }

            const phoneFixed = phoneFixedElement?.textContent?.trim().replace(/\s/g, '') || '';
            const phoneMobile = phoneMobileElement?.textContent?.trim().replace(/\s/g, '') || '';
            const phone = phoneMobile || phoneFixed; // Prefer mobile

            if (!phone) {
                 logger.warn("Client phone number not found.");
                 // Decide if this is critical - maybe notify?
                 // NotificationManager.notify("alert", "Numéro de téléphone client non trouvé.");
            }
             if (!firstName && !lastName) {
                 logger.warn("Client name not found.");
                 // Decide if this is critical
                 // NotificationManager.notify("alert", "Nom du client non trouvé.");
             }


            logger.log("Fetched Client Infos:", { firstName, lastName, phone });
            return { firstName, lastName, phone };
        }
    };

    // --- Geocoding Service ---

    const GeocodingService = {
        /**
         * Fetches geocode data (lat/lon) for a given address using fallback strategies.
         * @param {string} address - The full address string.
         * @returns {Promise<{latitude: number, longitude: number}|null>} Geocode data or null if failed.
         */
        fetchGeocodeData: async function(address) {
            logger.log("Fetching geocode data for address:", address);

            // Helper to make the API call
            const attemptGeocode = async (queryAddress) => {
                const url = `${CONFIG.geocodeApiUrl}?q=${encodeURIComponent(queryAddress)}&api_key=${CONFIG.geocodeApiKey}`;
                logger.log("Requesting Geocode from:", url);
                try {
                    const response = await makeCORSRequest(url, "GET", {}, null, 'json');
                    if (response && response.length > 0) {
                        const { lat, lon } = response[0];
                        if (lat && lon) {
                            logger.log("Geocode successful:", { latitude: parseFloat(lat), longitude: parseFloat(lon) });
                            return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
                        }
                    }
                    logger.warn("Geocode API returned no valid results for:", queryAddress);
                    return null;
                } catch (error) {
                    logger.error("Error fetching geocode data for", queryAddress, ":", error);
                    // Don't notify for intermediate failures, only final failure
                    return null;
                }
            };

            // 1. Try full address
            let geoData = await attemptGeocode(address);
            if (geoData) return geoData;

            // 2. Try address without leading house number (if exists)
            const addressWithoutHouseNumber = address.replace(/^\d+\s*,?\s*/, '');
            if (addressWithoutHouseNumber !== address) {
                logger.log("Retrying geocode without house number:", addressWithoutHouseNumber);
                await delay(CONFIG.geocodeRetryDelayMs);
                geoData = await attemptGeocode(addressWithoutHouseNumber);
                if (geoData) return geoData;
            }

            // 3. Try postal code and city only (assuming city follows postal code)
            const cityMatch = address.match(/\b\d{5}\b\s*(.+)/);
            if (cityMatch && cityMatch[1]) {
                const postalCode = address.match(/\b(\d{5})\b/)[1];
                const city = cityMatch[1].trim().split(',')[0]; // Take first part after postal code, before any comma
                 if (postalCode && city) {
                    const cityQuery = `${postalCode} ${city}`;
                    logger.log("Retrying geocode with postal code and city:", cityQuery);
                    await delay(CONFIG.geocodeRetryDelayMs);
                    geoData = await attemptGeocode(cityQuery);
                    if (geoData) return geoData;
                }
            }

            // 4. Try postal code only (least accurate)
            const postalCodeOnlyMatch = address.match(/\b(\d{5})\b/);
             if (postalCodeOnlyMatch) {
                 const postalCodeOnly = postalCodeOnlyMatch[1];
                 logger.log("Retrying geocode with postal code only:", postalCodeOnly);
                 await delay(CONFIG.geocodeRetryDelayMs);
                 geoData = await attemptGeocode(postalCodeOnly);
                 if (geoData) return geoData; // Accept less accurate result if others failed
             }


            // All attempts failed
            logger.error("Geocoding failed for address after multiple attempts:", address);
            NotificationManager.notify("alert", `Géolocalisation impossible pour l'adresse : "${address}". Vérifiez l'adresse.`);
            return null;
        }
    };

    // --- SAV (Castorama Internal) Service ---

    const SavService = {
        savCookie: null, // Store cookie in memory for the session

        /**
         * Attempts to set/refresh the SAV session cookie by visiting the base page.
         * Necessary because the subsequent AJAX calls might require a valid session cookie.
         */
        ensureSavSession: async function() {
             // No reliable way to get/check cookies directly with GM_xmlhttpRequest's response headers easily.
             // We rely on the subsequent requests failing with a specific pattern if the session is invalid.
             // This initial request helps establish a session if none exists.
            logger.log("Attempting to ensure SAV session...");
            try {
                // Make a simple GET request to the SAV base URL to potentially set cookies.
                // We don't need the response content itself.
                await makeCORSRequest(CONFIG.savBaseUrl + CONFIG.savInitUrl, "GET");
                logger.log("SAV base page visited (potential session establishment).");
                state.savSessionInitialized = true; // Assume success for now
            } catch (error) {
                logger.error("Error during SAV session initialization request:", error);
                // This might not be critical immediately, subsequent calls will handle failure.
                state.savSessionInitialized = false;
            }
        },

        /**
         * Handles the specific SAV error indicating a session/cookie issue.
         * Opens the SAV page in a popup for the user to log in or refresh the session manually.
         */
        handleSavSessionError: async function() {
            logger.warn("SAV session error detected (likely expired cookie).");
            NotificationManager.notify("alert", "Session SAV expirée ou invalide. Veuillez vous reconnecter.", {
                linkText: "Ouvrir SAV",
                linkUrl: CONFIG.savBaseUrl
            });

            // Close any existing popup
             if (state.savPopupWindow && !state.savPopupWindow.closed) {
                 state.savPopupWindow.close();
             }
            // Open SAV in a popup - user needs to interact with it.
            state.savPopupWindow = window.open(CONFIG.savBaseUrl, "SAV_Login_Popup", "width=800,height=600,scrollbars=yes,resizable=yes");
            state.savSessionInitialized = false; // Mark session as invalid

            // We cannot automatically re-login here. The script needs to be re-run after manual login.
            throw new Error("SAV session invalid. Please re-authenticate in the SAV popup and retry.");
        },

        /**
         * Fetches the internal product code from SAV using the EAN barcode.
         * Handles session errors and retries once after attempting session refresh.
         * @param {string} ean - The EAN barcode.
         * @returns {Promise<string|null>} The internal product code or null if not found/error.
         */
        fetchProductCode: async function(ean) {
            // Use hardcoded data if available
            if (CONFIG.hardcodedProductDetails[ean]) {
                logger.log(`Using hardcoded data for EAN ${ean}, returning EAN as product code.`);
                // Return the EAN itself as the identifier for hardcoded items
                return ean;
            }

            if (!state.savSessionInitialized) {
                 await this.ensureSavSession(); // Try to establish session if not done yet
            }


            const url = CONFIG.savBaseUrl + CONFIG.savSearchUrl;
            const headers = {
                "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "X-Prototype-Version": "1.5.1.2" // Keep if required by SAV backend
            };
            // Payload needs specific encoding used by Prototype.js (?) - Ensure this format is correct
            const payload = `__FormAjaxCall__=true&filtreRechercherProduit_codeBarre=${encodeURIComponent(ean)}&filtreRechercherProduit_LibMarque=&filtreRechercherProduit_idMarque=&filtreRechercherProduit_idSecteur=&filtreRechercherProduit_LibSdgSsFamMod=&filtreRechercherProduit_libelleProduit=&_=`;

            try {
                logger.log(`Fetching product code for EAN: ${ean}`);
                const responseText = await makeCORSRequest(url, "POST", headers, payload);

                // Check for the "Copyright (C)" string which indicates a session failure/redirect to login
                if (responseText.includes("Copyright (C)")) {
                    await this.handleSavSessionError(); // Throws an error to stop execution
                    return null; // Should not be reached due to throw
                }

                // Extract product code from the response (assuming voirProduit(ID,...) format)
                const match = responseText.match(/voirProduit\((\d+),/);
                if (match && match[1]) {
                    logger.log(`Found product code for EAN ${ean}: ${match[1]}`);
                    return match[1];
                } else {
                    logger.warn(`Could not extract product code for EAN ${ean} from SAV response.`);
                    return null;
                }
            } catch (error) {
                 // Check if the error was the one thrown by handleSavSessionError
                 if (error.message.includes("SAV session invalid")) {
                     throw error; // Re-throw to stop the main process
                 }
                logger.error(`Error fetching product code for EAN ${ean}:`, error);
                return null; // Indicate failure for this specific EAN
            }
        },

        /**
         * Fetches package dimension and weight data from SAV using the internal product code.
         * @param {string} productCode - The internal SAV product code or an EAN for hardcoded items.
         * @returns {Promise<Array<string>|null>} Array [length, width, height, weight] or null. Dimensions in cm, weight in kg.
         */
        fetchPackageData: async function(productCode) {
            // Use hardcoded data if available (productCode here might be the EAN)
            if (CONFIG.hardcodedProductDetails[productCode]) {
                logger.log(`Using hardcoded package data for ${productCode}.`);
                // Return a *copy* of the data
                return [...CONFIG.hardcodedProductDetails[productCode].packageData];
            }

             if (!state.savSessionInitialized) {
                 // This shouldn't happen if fetchProductCode was called first, but as a safeguard:
                 await this.ensureSavSession();
                 if (!state.savSessionInitialized) {
                     await this.handleSavSessionError(); // Will throw
                     return null;
                 }
             }

            const url = CONFIG.savBaseUrl + CONFIG.savDetailUrl;
            const headers = {
                "Accept": "text/javascript, text/html, application/xml, text/xml, */*",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "X-Prototype-Version": "1.5.1.2"
            };
            const payload = `__AjaxCall__=true&idProduit=${encodeURIComponent(productCode)}&isGoBack=false&_=`;

            try {
                logger.log(`Fetching package data for product code: ${productCode}`);
                const responseText = await makeCORSRequest(url, "POST", headers, payload);

                // Check for session error again
                if (responseText.includes("Copyright (C)")) {
                    await this.handleSavSessionError(); // Throws an error
                    return null;
                }

                // --- Data Extraction Logic ---
                // This part relies heavily on the structure of the CDATA content
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(responseText, "text/xml");
                const cdataContent = xmlDoc.querySelector('data')?.textContent;

                if (!cdataContent) {
                    logger.warn(`No CDATA content found in SAV response for product code ${productCode}.`);
                    return null;
                }

                // Regex to find the "Poids et dimension" section
                // Making it more robust: look for the header and capture the content of the *next* <td>
                const sectionRegex = /<td[^>]*>\s*Poids et dimension\s*<\/td>\s*<td[^>]*class="info"[^>]*>([\s\S]*?)<\/td>/i;
                const sectionMatch = cdataContent.match(sectionRegex);

                if (!sectionMatch || !sectionMatch[1]) {
                    logger.warn(`'Poids et dimension' section not found or empty for product code ${productCode}.`);
                    return null;
                }

                // Clean the extracted text: remove HTML tags, normalize whitespace, replace  
                const textContent = sectionMatch[1]
                    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
                    .replace(/ /g, ' ')   // Replace non-breaking spaces
                    .replace(/\s+/g, ' ')     // Normalize whitespace
                    .trim();

                logger.log("Raw text for dimensions/weight:", textContent);

                // Regex to find dimensions (e.g., 100 x 50 x 20 cm) - flexible separator (x, X, *)
                // Allowing decimals (.), capturing 3 dimension numbers
                const dimensionMatch = textContent.match(/(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*cm/i);
                // Regex to find weight (e.g., 25.5 kg) - allowing decimals
                const weightMatch = textContent.match(/(\d+(?:[.,]\d+)?)\s*kg/i);

                const parseAndRound = (valueStr) => {
                    if (!valueStr) return "N/A";
                    // Replace comma decimal separator with period
                    const normalizedValue = valueStr.replace(',', '.');
                    const num = parseFloat(normalizedValue);
                    // Round to nearest integer for dimensions, keep 2 decimals for weight?
                    // Original script rounded all. Let's stick to that for consistency, but maybe adjust later.
                    return !isNaN(num) ? Math.round(num).toString() : "N/A";
                     // Or for weight with decimals: return !isNaN(num) ? num.toFixed(2) : "N/A";
                };

                let dims = ["N/A", "N/A", "N/A"];
                if (dimensionMatch) {
                    // Extract the 3 dimension captures
                    dims = [
                        parseAndRound(dimensionMatch[1]),
                        parseAndRound(dimensionMatch[2]),
                        parseAndRound(dimensionMatch[3])
                    ];
                    // Sort dimensions: Length (largest), Width, Height (smallest) - consistent with Colisweb?
                     // Colisweb often asks for Longest, Height, Width. Let's sort Descending.
                     dims.sort((a, b) => parseFloat(b) - parseFloat(a));
                } else {
                     logger.warn(`Could not parse dimensions from text: "${textContent}"`);
                }

                let weight = "N/A";
                if (weightMatch) {
                    weight = parseAndRound(weightMatch[1]); // Use parseAndRound for consistency
                } else {
                     logger.warn(`Could not parse weight from text: "${textContent}"`);
                }


                if (dims.includes("N/A") || weight === "N/A") {
                    logger.warn(`Incomplete package data found for ${productCode}: Dims=${dims.join(',')}, Weight=${weight}`);
                     // Return null or a specific marker? Returning null to indicate failure for this item.
                    return null;
                }

                // Return sorted dimensions [Length, Width, Height] and Weight
                const packageData = [...dims, weight];
                logger.log(`Successfully extracted package data for ${productCode}:`, packageData);
                return packageData; // [L, W, H, Wt]

            } catch (error) {
                if (error.message.includes("SAV session invalid")) {
                     throw error; // Re-throw to stop the main process
                 }
                logger.error(`Error fetching package data for product code ${productCode}:`, error);
                return null;
            }
        },

        /**
         * Calculates overall package metrics from fetched product data.
         * @param {Array<{ean: string, quantity: number, packageData: Array<string>|null}>} products - Array of product details.
         * @returns {object|null} Object with metrics or null if no valid data.
         */
        calculatePackageMetrics: function(products) {
            let totalPackages = 0;
            let totalWeightKg = 0;
            let maxPackageWeightKg = 0;
            let longestPackageLengthCm = 0;
            let longestPackageDims = null; // { length, width, height }

             const validProducts = products.filter(p => p.packageData && p.packageData.length === 4 && !p.packageData.includes("N/A"));

             if (validProducts.length === 0) {
                 logger.warn("No valid product package data found to calculate metrics.");
                 return null;
             }

            validProducts.forEach(item => {
                const quantity = item.quantity;
                 // Ensure data are numbers. packageData is [L, W, H, Wt] (sorted descending L, W, H)
                 const length = parseFloat(item.packageData[0]);
                 const width = parseFloat(item.packageData[1]);
                 const height = parseFloat(item.packageData[2]);
                 const weight = parseFloat(item.packageData[3]);

                if (isNaN(length) || isNaN(width) || isNaN(height) || isNaN(weight) || quantity <= 0) {
                    logger.warn(`Invalid data skipped for EAN ${item.ean}:`, item.packageData, `Qty: ${quantity}`);
                    return; // Skip this item if data is invalid
                }

                totalPackages += quantity;
                totalWeightKg += weight * quantity;
                maxPackageWeightKg = Math.max(maxPackageWeightKg, weight);

                // Check if this item's length is the longest found so far
                 if (length > longestPackageLengthCm) {
                    longestPackageLengthCm = length;
                    // Colisweb needs Longest, Height, Width of the *single longest* package type
                    // We assume the SAV data [L, W, H] is already sorted L >= W >= H
                     longestPackageDims = { length, width, height }; // Store dimensions of this longest package
                 }
                 // If multiple packages have the same max length, Colisweb usually wants the dimensions
                 // of *one* of them. Taking the first one we encounter with max length is usually fine.
            });

             // Round totals for clarity? Colisweb might prefer integers or specific precision.
             // totalWeightKg = parseFloat(totalWeightKg.toFixed(2));
             // maxPackageWeightKg = parseFloat(maxPackageWeightKg.toFixed(2));


            const metrics = {
                totalPackages,
                totalWeightKg,
                maxPackageWeightKg,
                longestPackageLengthCm, // Longest dimension of the single longest package type
                longestPackageDims // Dimensions {length, width, height} of that longest package
            };

            logger.log("Calculated Package Metrics:", metrics);
            return metrics;
        }
    };

    // --- Colisweb Service ---

    const ColiswebService = {
        coliswebCookie: null, // Store session cookie in memory

        /**
         * Attempts to log in to Colisweb API to get a session cookie.
         * @returns {Promise<boolean>} True if login successful, false otherwise.
         */
        login: async function() {
            logger.log("Attempting Colisweb API login...");
            const url = CONFIG.coliswebApiBaseUrl + CONFIG.coliswebLoginUrl;
            const headers = {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json"
                // No cookie needed for login request itself
            };
            const payload = {
                username: CONFIG.coliswebUsername,
                password: CONFIG.coliswebPassword,
            };

            try {
                 // GM_xmlhttpRequest doesn't automatically handle/expose Set-Cookie from responses easily.
                 // We *cannot* reliably get the cookie this way.
                 // The script relies on the browser handling the cookie after a manual login via the popup,
                 // or potentially if GM_xhr includes cookies automatically based on @connect (needs verification).

                 // This function is now mainly conceptual or for logging purposes.
                 // The real "login" happens when the user logs in via the Colisweb website.
                 // We will *detect* expired sessions in fetchDeliveryOptions and prompt for manual login.

                 // *** If GM_xmlhttpRequest *does* store cookies for connected domains,
                 //     this request might refresh it. Test needed. ***

                // Simplified: Assume login must be manual via website/popup for reliable cookie handling.
                logger.log("Colisweb login attempt simulated. Manual login via website required for session cookie.");
                 // We can't confirm success here without response header access.
                 return false; // Indicate we can't guarantee success programmatically.

            } catch (error) {
                logger.error("Error during Colisweb login attempt:", error);
                NotificationManager.notify("alert", "Erreur lors de la tentative de connexion à l'API Colisweb.");
                return false;
            }
        },

        /**
         * Handles Colisweb session errors by prompting the user to log in manually.
         */
        handleSessionError: function() {
            logger.warn("Colisweb session error detected (Expired or Unauthorized).");
            NotificationManager.notify("alert", "Session Colisweb expirée ou invalide.", {
                linkText: "Se connecter à Colisweb",
                linkUrl: CONFIG.coliswebLoginRedirectUrl
            });
             // Close any existing popup
             if (state.cwPopupWindow && !state.cwPopupWindow.closed) {
                 state.cwPopupWindow.close();
             }
            state.cwPopupWindow = window.open(CONFIG.coliswebLoginRedirectUrl, "Colisweb_Login_Popup", "width=800,height=600,scrollbars=yes,resizable=yes");
            // Cannot proceed until user logs in manually and script is re-run.
            throw new Error("Colisweb session invalid. Please log in via the Colisweb popup and retry.");
        },

        /**
         * Fetches available delivery options and prices from Colisweb.
         * @param {object} geocodeData - { latitude, longitude }.
         * @param {object} packageMetrics - Calculated metrics from SavService.
         * @param {string} postalCode - Destination postal code.
         * @returns {Promise<object|string|null>} Price object, specific error string ('heavy', 'distance', 'no_offer'), or null on failure.
         */
        fetchDeliveryOptions: async function(geocodeData, packageMetrics, postalCode) {
            logger.log("Fetching Colisweb delivery options...");

            if (!geocodeData || !packageMetrics || !postalCode) {
                logger.error("Missing required data for fetching delivery options.");
                NotificationManager.notify("alert", "Données manquantes (géoloc, colis, code postal) pour interroger Colisweb.");
                return null;
            }

            const url = CONFIG.coliswebApiBaseUrl + CONFIG.coliswebOptionsUrl;
            const headers = {
                "Content-Type": "application/json",
                 // Relies on browser automatically including the cookie for the domain.
                 // If cookies aren't sent automatically, this will fail.
                // "Cookie": this.coliswebCookie // Manually setting cookie is unreliable here
            };

            // Dynamic date range (Today to Today + 2 days)
            const now = new Date();
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + 2);

            const payload = {
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                pickupAddress: {
                    latitude: CONFIG.pickupLocation.latitude,
                    longitude: CONFIG.pickupLocation.longitude,
                    postalCode: CONFIG.pickupLocation.postalCode,
                    storeId: CONFIG.pickupLocation.storeId.toString(), // Ensure string
                    geocodingLevel: "streetAddress", // Assuming store address is precise
                    // administrativeArea might be needed depending on API strictness
                },
                shippingAddress: {
                    latitude: geocodeData.latitude,
                    longitude: geocodeData.longitude,
                    postalCode: postalCode,
                    additionalInformation: { floor: null, hasLift: "maybe_lift" }, // Default values
                    geocodingLevel: "streetAddress", // Assuming geocode is precise enough
                    // administrativeArea might be needed
                },
                packaging: {
                    numberOfPackets: packageMetrics.totalPackages,
                    // Dimensions of the *single longest* package type
                    heightCm: packageMetrics.longestPackageDims?.height,
                    lengthCm: packageMetrics.longestPackageDims?.length, // Longest dimension overall
                    widthCm: packageMetrics.longestPackageDims?.width,
                    weightKg: packageMetrics.totalWeightKg, // Total weight of all packages
                    maxPacketWeightKg: packageMetrics.maxPackageWeightKg, // Weight of the single heaviest package
                    maxPacketLengthCm: packageMetrics.longestPackageLengthCm // Longest dimension overall
                },
                requiredSkills: ["sidewalkdelivery"] // Default skill
            };

             // Clean up potential null/undefined values in payload before sending
             // (Could recursively clean, but handling known ones is often sufficient)
             if (payload.packaging.heightCm === undefined) delete payload.packaging.heightCm;
             if (payload.packaging.lengthCm === undefined) delete payload.packaging.lengthCm;
             if (payload.packaging.widthCm === undefined) delete payload.packaging.widthCm;


            logger.log("Colisweb API Payload:", payload);


            try {
                const response = await makeCORSRequest(url, "POST", headers, payload, 'json');
                logger.log("Colisweb API Response:", response); // Log the raw response

                // --- Response Parsing ---
                // Check for session errors FIRST
                if (response?.code?.includes('EXPIRED') || response?.message?.includes('Unauthorized') || response?.message?.includes('Invalid JWT')) {
                    this.handleSessionError(); // Throws error
                    return null;
                }

                // Check for specific operational errors
                 if (response?.error) {
                    if (response.error.includes('heavy') || response.error.includes('WEIGHT')) {
                         logger.warn("Colisweb: Order too heavy.");
                         NotificationManager.notify("alert", "Cette commande est trop lourde pour Colisweb.", {
                             details: { "Poids total": `${packageMetrics.totalWeightKg} kg`, "Colis le + lourd": `${packageMetrics.maxPackageWeightKg} kg`},
                             linkText: "Demander un devis",
                             linkUrl: CONFIG.coliswebQuoteUrl
                         });
                         return "heavy";
                     }
                    if (response.error.includes('distance') || response.error.includes('DISTANCE')) {
                         logger.warn("Colisweb: Distance too far.");
                         NotificationManager.notify("alert", "Pas d'offres Colisweb existantes pour cette distance.");
                         return "distance";
                     }
                     // Handle other potential known errors by code/message
                 }

                // Check for 'No compatible load type' error
                if (response?.code?.includes('LOAD') || response?.message?.includes('load type')) {
                    logger.warn("Colisweb: No compatible offer found.");
                    NotificationManager.notify("alert", "Aucune offre Colisweb compatible trouvée pour ces colis/dimensions.", {
                          details: {
                            "Nb Colis": packageMetrics.totalPackages,
                            "Poids Total": `${packageMetrics.totalWeightKg} kg`,
                            "Colis Max (L×l×H)": `${packageMetrics.longestPackageDims?.length ?? 'N/A'}×${packageMetrics.longestPackageDims?.width ?? 'N/A'}×${packageMetrics.longestPackageDims?.height ?? 'N/A'} cm`
                          },
                          linkText: "Demander un devis",
                          linkUrl: CONFIG.coliswebQuoteUrl
                      });
                    return "no_offer";
                }

                // Check for successful response with price data
                if (response?.calendar && Array.isArray(response.calendar) && response.calendar.length > 0) {
                    const firstOption = response.calendar[0];
                    if (firstOption.priceWithTaxes !== undefined && firstOption.priceWithTaxes !== null) {
                         const price = parseFloat(firstOption.priceWithTaxes);
                         if (!isNaN(price)) {
                            logger.log(`Colisweb price found: ${price} (HT)`);
                            return { priceWithTaxes: price }; // Return the price object
                        }
                    }
                }

                // If none of the above conditions met, it's an unknown state or error
                logger.error("Colisweb: Unknown response format or no price found.", response);
                NotificationManager.notify("alert", "Réponse inattendue de Colisweb ou prix non trouvé.", { details: JSON.stringify(response).substring(0, 200) + "..." });
                return null;

            } catch (error) {
                 if (error.message.includes("Colisweb session invalid")) {
                     throw error; // Re-throw session error to stop process
                 }
                 // Handle other network or HTTP errors from makeCORSRequest
                 logger.error("Error fetching Colisweb delivery options:", error);
                 NotificationManager.notify("alert", `Erreur réseau ou serveur lors de la requête Colisweb: ${error.message}`);
                return null;
            }
        }
    };

    // --- UI Interaction (Castorama Basket) ---

    const BasketUI = {
        /**
         * Creates a styled button.
         * @param {object} options - { id, textContent, styles, onClick }
         * @returns {HTMLButtonElement}
         */
        createButton: function({ id, textContent, styles, onClick }) {
            const button = document.createElement('button');
            button.id = id;
            button.textContent = textContent;
            Object.assign(button.style, {
                zIndex: '1000', position: 'relative', backgroundClip: 'padding-box',
                backgroundColor: '#0078d7', borderRadius: '5px', border: '1px solid #005cca',
                color: '#fff', display: 'inline-block', padding: '7px 10px', height: '30px',
                textDecoration: 'none', width: 'auto', cursor: 'pointer', margin: '0',
                font: 'bold 1em / 1.25 Arial, Helvetica, sans-serif', whiteSpace: 'nowrap',
                transition: 'background-color 0.2s ease',
                ...styles
            });
            button.addEventListener('click', onClick);
            button.addEventListener("mouseover", () => button.style.backgroundColor = "#005CE6");
            button.addEventListener("mouseout", () => button.style.backgroundColor = "#0078d7");
            return button;
        },

        /**
         * Adds the custom 'Estimate' and 'Program' buttons to the basket page.
         * Uses MutationObserver to handle dynamic content loading.
         */
        setupCustomButtons: function() {
            const createAndInsertButtons = () => {
                 const container = document.querySelector(CONFIG.checkoutButtonContainerSelector);
                 const existingEstimateButton = document.getElementById('tm-estimate-button');
                 const checkoutButton = container?.querySelector(CONFIG.checkoutProceedButtonSelector);

                 if (container && checkoutButton && !existingEstimateButton) {
                    logger.log("Adding custom buttons to basket UI.");

                    state.estimateButton = this.createButton({
                        id: 'tm-estimate-button',
                        textContent: 'Estimer Colisweb',
                        styles: { marginLeft: '10px', marginTop: '10px', width: 'auto' }, // Adjusted styles
                        onClick: handleEstimateAction // Call the main estimation handler
                    });

                    state.deliveryButton = this.createButton({
                        id: 'tm-program-button',
                        textContent: 'Programmer Colisweb',
                        styles: { marginLeft: '10px', marginTop: '10px', display: 'none' }, // Initially hidden
                        onClick: () => {
                            // Ensure data is saved before opening
                            StorageManager.load().then(details => {
                                if (details) {
                                    logger.log("Opening Colisweb create delivery page.");
                                    window.open(CONFIG.coliswebCreateDeliveryUrl, 'Colisweb_CreateDelivery');
                                } else {
                                    logger.warn("Cannot open Colisweb page, no delivery details found in storage.");
                                    NotificationManager.notify("alert", "Veuillez d'abord estimer le prix avant de programmer la livraison.");
                                }
                            });
                        }
                    });

                    // Insert buttons before the original checkout button
                    container.insertBefore(state.estimateButton, checkoutButton);
                    container.insertBefore(state.deliveryButton, checkoutButton);

                    return true; // Buttons added
                }
                return false; // Conditions not met
            };

            // Try adding immediately in case the elements are already there
             if (createAndInsertButtons()) {
                 return; // Added successfully, no need for observer yet
             }

            // If not found immediately, set up an observer
            const observer = new MutationObserver((mutationsList, obs) => {
                // Check if the target container and button are now available
                if (document.querySelector(CONFIG.checkoutButtonContainerSelector) &&
                    document.querySelector(CONFIG.checkoutProceedButtonSelector)) {
                    if (createAndInsertButtons()) {
                        obs.disconnect(); // Stop observing once buttons are added
                        logger.log("MutationObserver added buttons and disconnected.");
                    }
                 }
             });

             observer.observe(document.body, { childList: true, subtree: true });
             logger.log("MutationObserver started to watch for button container.");
        }
    };

    // --- UI Interaction (Colisweb Autofill) ---

    const ColiswebAutofillUI = {

        /**
         * Safely waits for an element to be visible and returns it.
         * @param {string} selector - The CSS selector for the element.
         * @param {number} timeoutMs - Maximum time to wait in milliseconds.
         * @returns {Promise<Element|null>} The element or null if not found/visible within timeout.
         */
        waitForElement: async function(selector, timeoutMs = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeoutMs) {
                const element = document.querySelector(selector);
                if (isElementVisible(element)) {
                    logger.log(`Element found and visible: ${selector}`);
                    return element;
                }
                await delay(100); // Wait before checking again
            }
            logger.warn(`Element not found or not visible within ${timeoutMs}ms: ${selector}`);
            return null;
        },

        /**
         * Fills a standard input field, attempting to trigger React's change detection.
         * @param {string} selector - CSS selector for the input field.
         * @param {string} value - The value to set.
         * @returns {Promise<boolean>} True if successful, false otherwise.
         */
        fillReactInput: async function(selector, value) {
            const inputField = await this.waitForElement(selector);
            if (!inputField) return false;

            logger.log(`Filling input ${selector} with value: ${value}`);

             // React 17+ way: Set value property directly and dispatch events
             // This is generally more reliable than manipulating prototype setters
             try {
                // Set the value
                inputField.value = value;

                // Dispatch 'input' event - often needed for controlled components
                inputField.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

                // Dispatch 'change' event - sometimes needed as well
                inputField.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

                 // Blur to trigger potential validation or state updates
                 // await delay(50); // Small delay before blur
                 // inputField.blur();

                return true;
            } catch (error) {
                logger.error(`Error filling React input ${selector}:`, error);
                return false;
            }
        },

        /**
         * Specifically handles the address combobox/autocomplete field.
         * @param {string} addressValue - The address to type and potentially select.
         * @returns {Promise<boolean>} True if successful, false otherwise.
         */
        fillAddressCombobox: async function(addressValue) {
            const addressInput = await this.waitForElement(CONFIG.coliswebAddressInputSelector);
            if (!addressInput) return false;

            logger.log("Filling address combobox with:", addressValue);

            try {
                addressInput.focus();
                addressInput.value = addressValue; // Set the value directly
                addressInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event

                // Wait briefly for potential dropdown options to appear
                await delay(500);

                // Look for the first option in the dropdown
                const firstOption = document.querySelector(CONFIG.coliswebAddressOptionSelector); // More specific selector if possible
                if (firstOption && isElementVisible(firstOption)) {
                    logger.log("Clicking first address option:", firstOption.textContent);
                    firstOption.click();
                } else {
                    logger.log("No address option found or visible, blurring input.");
                     // If no dropdown/option, just trigger change and blur
                     addressInput.dispatchEvent(new Event('change', { bubbles: true }));
                     addressInput.blur();
                }
                return true;
            } catch (error) {
                logger.error("Error filling address combobox:", error);
                return false;
            }
        },

        /**
         * Highlights a specific radio/boolean choice based on a value.
         * @param {string} baseSelector - Base selector for the group container.
         * @param {string} choiceSelector - Specific selector for the choice to highlight.
         * @returns {Promise<void>}
         */
        highlightChoice: async function(choiceSelector) {
            const choiceElement = await this.waitForElement(choiceSelector); // Wait for the specific label/element
             if (choiceElement) {
                 logger.log(`Highlighting choice: ${choiceSelector}`);
                 Object.assign(choiceElement.style, {
                    backgroundColor: '#9fe8f2', // Highlight color
                    transition: 'background-color 0.5s ease-in-out',
                    border: '2px solid #0078d7' // Add border for more visibility
                 });
                 // Optional: scroll into view
                 // choiceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
             } else {
                 logger.warn(`Could not find choice element to highlight: ${choiceSelector}`);
             }
        },

         /**
         * Sets placeholder text for an input field.
         * @param {string} selector - CSS selector for the input.
         * @param {string} value - Placeholder text.
         * @returns {Promise<void>}
         */
        setInputPlaceholder: async function(selector, value) {
            const inputField = await this.waitForElement(selector);
            if (inputField) {
                logger.log(`Setting placeholder for ${selector}: "${value}"`);
                inputField.setAttribute('placeholder', value);
            }
        },

        /**
         * Determines which height choice to highlight.
         * @param {number} heightCm - The height in cm.
         */
        highlightHeightChoice: async function(heightCm) {
             if (isNaN(heightCm)) return;
             logger.log(`Highlighting height choice for ${heightCm} cm`);
             if (heightCm < 150) {
                 await this.highlightChoice(CONFIG.coliswebHeightLt150Selector);
             } else if (heightCm <= 180) { // Assuming inclusive 150-180
                 await this.highlightChoice(CONFIG.coliswebHeight150to180Selector);
             } else { // > 180
                 await this.highlightChoice(CONFIG.coliswebHeightGt180Selector);
             }
         },

         /**
          * Determines which width choice to highlight.
          * @param {number} widthCm - The width in cm.
          */
         highlightWidthChoice: async function(widthCm) {
             if (isNaN(widthCm)) return;
             logger.log(`Highlighting width choice for ${widthCm} cm`);
             if (widthCm <= 50) {
                 await this.highlightChoice(CONFIG.coliswebWidthLtEq50Selector);
             } else { // > 50
                 await this.highlightChoice(CONFIG.coliswebWidthGt50Selector);
             }
         }
    };

    // --- Popup Window Management ---

    const PopupManager = {
        /**
         * Intercepts XMLHttpRequest to detect specific API calls and close related popups.
         * @param {string} urlKeyword - Keyword in the URL to monitor.
         * @param {'sav'|'colisweb'|'other'} popupType - Type of popup to close ('sav' or 'colisweb').
         */
        closePopupOnApiSuccess: function(urlKeyword, popupType) {
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function(method, url) {
                this._url = url; // Store URL for send check
                originalOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function() {
                if (this._url && this._url.includes(urlKeyword)) {
                    this.addEventListener('load', function() {
                        if (this.status >= 200 && this.status < 300) {
                            logger.log(`Detected successful API call (${urlKeyword}), closing ${popupType} popup.`);
                            const popupWindow = (popupType === 'sav') ? state.savPopupWindow : state.cwPopupWindow;
                            if (popupWindow && !popupWindow.closed) {
                                popupWindow.close();
                            }
                             if (popupType === 'sav') state.savPopupWindow = null;
                             if (popupType === 'colisweb') state.cwPopupWindow = null;

                            // Special case for SAV popup initiated by the script: close the script's host window too?
                             // This was in the original script, but seems dangerous. Commented out.
                             // if (popupType === 'sav' && window.name === "SAV_popupWindow") {
                             //    window.close();
                             // }
                        }
                    });
                }
                originalSend.apply(this, arguments);
            };
             logger.log(`Interceptor set up to close ${popupType} popup on success of requests containing "${urlKeyword}"`);
        }
    };


    // --- Main Workflow Functions ---

    /**
     * Handles the 'Estimate Colisweb Price' button click.
     * Orchestrates fetching data, calculating metrics, and getting quotes.
     */
    async function handleEstimateAction() {
        logger.log("Estimate button clicked.");
        LoaderManager.show();
        if (state.estimateButton) state.estimateButton.textContent = 'Calcul en cours...';
        if (state.deliveryButton) state.deliveryButton.style.display = 'none'; // Hide program button during estimation
        // Clear previous results from storage? Optional, maybe keep last successful one.
        // await StorageManager.clear(); // Uncomment to always clear before estimation

        try {
            // 1. Fetch Base Data from Castorama Page
            const productsInput = CastoDataExtractor.fetchEANsAndQuantities();
            const clientAddress = CastoDataExtractor.fetchClientAddress();
            const clientInfo = CastoDataExtractor.fetchClientInfos();

            if (!productsInput || productsInput.length === 0 || !clientAddress || !clientInfo) {
                throw new Error("Données client ou panier incomplètes. Impossible de continuer.");
            }

            // 2. Fetch Geocode Data
            const geocodeData = await GeocodingService.fetchGeocodeData(clientAddress.address);
            if (!geocodeData) {
                // Error already notified by GeocodingService
                throw new Error("Échec de la géolocalisation.");
            }

            // 3. Fetch Product Details from SAV (Iterative)
            const fetchedProductDetails = [];
             const failedEANs = [];
             // Ensure SAV session is potentially active before starting loop
             // await SavService.ensureSavSession(); // ensureSavSession is called within fetchProductCode if needed

             for (const item of productsInput) {
                const productCode = await SavService.fetchProductCode(item.ean); // Handles hardcoded EANs too
                 if (!productCode) {
                     logger.warn(`Failed to get product code for EAN ${item.ean}. Skipping item.`);
                     failedEANs.push(item.ean);
                     fetchedProductDetails.push({ ...item, packageData: null }); // Mark as failed
                     continue;
                 }

                const packageData = await SavService.fetchPackageData(productCode); // Handles hardcoded using productCode (which might be EAN)
                 if (!packageData) {
                     logger.warn(`Failed to get package data for EAN ${item.ean} (Code: ${productCode}). Skipping item.`);
                     failedEANs.push(item.ean);
                     fetchedProductDetails.push({ ...item, packageData: null }); // Mark as failed
                 } else {
                     fetchedProductDetails.push({ ...item, packageData });
                 }
                 await delay(50); // Small delay between SAV calls to avoid overwhelming it
            }

             if (fetchedProductDetails.filter(p => p.packageData).length === 0) {
                 throw new Error("Aucune donnée de colis valide n'a pu être récupérée depuis SAV.");
             }

            // 4. Calculate Overall Metrics
            const packageMetrics = SavService.calculatePackageMetrics(fetchedProductDetails);
            if (!packageMetrics) {
                 throw new Error("Impossible de calculer les métriques des colis (données invalides).");
            }

            // 5. Fetch Delivery Options from Colisweb
            const deliveryOptionResult = await ColiswebService.fetchDeliveryOptions(
                geocodeData,
                packageMetrics,
                clientAddress.postalCode
            );

            // 6. Handle Colisweb Response
            if (typeof deliveryOptionResult === 'object' && deliveryOptionResult?.priceWithTaxes !== undefined) {
                // Success! Show price and store data.
                 const price = deliveryOptionResult.priceWithTaxes;
                 NotificationManager.showQuote(price, packageMetrics, failedEANs);

                // Prepare data for storage
                const dataToStore = {
                    clientInfo: clientInfo,
                    address: clientAddress.address,
                    postalCode: clientAddress.postalCode,
                    geocode: geocodeData,
                    packageMetrics: packageMetrics,
                    // Optionally store raw product details or failed EANs
                    // products: fetchedProductDetails,
                     failedEANs: failedEANs
                };

                // Save data for autofill script
                 const saved = await StorageManager.save(dataToStore);
                 if (saved && state.deliveryButton) {
                    state.deliveryButton.style.display = 'inline-block'; // Show 'Program' button
                 }

            } else if (typeof deliveryOptionResult === 'string') {
                // Specific known issue (heavy, distance, no_offer) - already notified by ColiswebService
                logger.warn(`Colisweb estimation stopped due to: ${deliveryOptionResult}`);
                 // Keep 'Program' button hidden
            } else {
                // Generic failure or null result - already notified by ColiswebService
                throw new Error("Échec de l'obtention des options de livraison Colisweb.");
            }

        } catch (error) {
            logger.error("Error during estimation process:", error);
             // Avoid duplicate notifications if possible, but ensure user sees the final failure cause
             if (!error.message.includes("session invalid")) { // Don't repeat session error messages
                 NotificationManager.notify("alert", `Erreur lors du calcul : ${error.message}`);
             }
             // Ensure 'Program' button remains hidden on error
             if (state.deliveryButton) state.deliveryButton.style.display = 'none';
        } finally {
            LoaderManager.hide();
            if (state.estimateButton) state.estimateButton.textContent = 'Estimer Colisweb'; // Reset button text
        }
    }

    /**
     * Executes logic for the Castorama Basket/Checkout page.
     */
    async function runCastoramaScript() {
        logger.log("Running script on Castorama basket/checkout page.");
        LoaderManager.init(); // Prepare loader
        BasketUI.setupCustomButtons(); // Add Estimate/Program buttons

        // Periodically try to initialize SAV session in the background?
        // This helps if the user stays on the page long time before clicking estimate.
        // But might be unnecessary if ensureSavSession works well on demand.
        // setInterval(async () => {
        //     if (!state.savSessionInitialized) {
        //         await SavService.ensureSavSession();
        //     }
        // }, CONFIG.sessionInitIntervalMs);
         // Initial attempt
         // await SavService.ensureSavSession(); // Do it once on load?
    }

    /**
     * Executes logic for the Colisweb Login page.
     */
    async function runColiswebLoginScript() {
        logger.log("Running script on Colisweb login page.");
        // Autofill login credentials
        await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebUsernameSelector, CONFIG.coliswebUsername);
        await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebPasswordSelector, CONFIG.coliswebPassword);

        // Set up listener to close the login popup upon successful login API call
        PopupManager.closePopupOnApiSuccess(CONFIG.coliswebLoginUrl, 'colisweb');

        logger.log("Login fields autofilled. Please click 'Login'.");
        // We cannot reliably click the login button due to potential captchas or dynamic elements.
    }

    /**
     * Executes logic for the Colisweb Create Delivery page (Autofill).
     */
    async function runColiswebAutofillScript() {
        logger.log("Running script on Colisweb create delivery page.");
        LoaderManager.init();
        LoaderManager.show(); // Show loader during autofill

        try {
            const deliveryDetails = await StorageManager.load();
            if (!deliveryDetails) {
                NotificationManager.notify("alert", "Aucune donnée de livraison trouvée pour le remplissage automatique. Veuillez d'abord estimer sur Castorama.");
                // Clear potentially old/stale GM values if load fails?
                // await StorageManager.clear();
                throw new Error("No delivery details found for autofill.");
            }

            logger.log("Autofilling Colisweb form with details:", deliveryDetails);

            // Destructure for easier access, with fallbacks
            const {
                clientInfo = {},
                address = '',
                packageMetrics = {}
            } = deliveryDetails;
             const { firstName = '', lastName = '', phone = '' } = clientInfo;
             const {
                 totalPackages = 0,
                 maxPackageWeightKg = 0,
                 totalWeightKg = 0,
                 longestPackageDims = {} // { length, width, height }
             } = packageMetrics;
             const { length = 0, width = 0, height = 0 } = longestPackageDims;


             // Fill form fields sequentially
             await ColiswebAutofillUI.fillAddressCombobox(address);
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebFirstNameSelector, firstName);
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebLastNameSelector, lastName);
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebPhoneSelector, phone);

             // Fill package details
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebPackagesQtySelector, totalPackages.toString());
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebHeaviestPkgSelector, maxPackageWeightKg.toString());
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebTotalWeightSelector, totalWeightKg.toString());
             await ColiswebAutofillUI.fillReactInput(CONFIG.coliswebLongestPkgSelector, length.toString());

             // Highlight boolean choices based on dimensions of the longest package
             await ColiswebAutofillUI.highlightHeightChoice(height); // Height of the longest item
             await ColiswebAutofillUI.highlightWidthChoice(width);   // Width of the longest item


             // Optionally set placeholders as hints for fields that might need manual review
             await ColiswebAutofillUI.setInputPlaceholder("#additionalAddressDetails", "Ex: Code porte, interphone, étage...");
             await ColiswebAutofillUI.setInputPlaceholder("#comments", "Instructions spécifiques pour le livreur...");


             // Clear storage after successful autofill? Or keep it for reference?
             // Keeping it seems safer in case the user needs to retry.
             // await StorageManager.clear();

            logger.log("Colisweb form autofill completed.");
             NotificationManager.notify("info", "Formulaire Colisweb pré-rempli. Veuillez vérifier les informations avant de continuer.");

        } catch (error) {
            logger.error("Error during Colisweb autofill:", error);
            // Notification already handled if it was due to missing data
        } finally {
            LoaderManager.hide();
        }
    }

    /**
     * Executes logic for the SAV Popup window.
     */
    async function runSavPopupScript() {
        logger.log("Running script in SAV popup window.");
        // The main goal here is to close the popup once the user successfully logs in
        // or performs an action that refreshes the session. We listen for the initAccueil call.
        PopupManager.closePopupOnApiSuccess(CONFIG.savInitUrl, 'sav');
        logger.log("SAV popup script setup complete. Waiting for user interaction or session refresh.");
        // No autofill needed here, user interaction is required.
    }

    // --- Script Entry Point and Routing ---

    logger.log("Script starting. Analyzing URL:", window.location.href);
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // Route based on URL
    if (hostname.includes('castorama.fr') && (pathname.includes('/basket') || pathname.includes('/checkout'))) {
        runCastoramaScript();
    } else if (hostname.includes('bo.production.colisweb.com')) {
        if (pathname.includes('/login')) {
            runColiswebLoginScript();
        } else if (pathname.includes('/create-delivery')) {
            runColiswebAutofillScript();
        } else {
            logger.log("Script active on Colisweb, but no specific action for this page:", pathname);
        }
    } else if (hostname.includes('agile.intranet.castosav.castorama.fr')) {
        // Check if this window was opened as the SAV popup
         if (window.name === "SAV_Login_Popup") {
            runSavPopupScript();
         } else {
             logger.log("Script active on SAV domain, but not in the expected popup window.", window.name);
             // Potentially run SAV session init here if needed for direct access?
             // await SavService.ensureSavSession();
         }
    } else {
        logger.log("Script active, but URL does not match any specific action rules.");
    }

})();
