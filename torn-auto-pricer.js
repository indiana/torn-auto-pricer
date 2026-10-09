// ==UserScript==
// @name         Torn Item Market Auto Pricer
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Automatically fetches lowest, median, and maximum market prices via Torn API v2, sets the lowest price, and displays a tooltip hint.
// @author       Rednels
// @match        https://www.torn.com/page.php?sid=ItemMarket*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// ==/UserScript==

(function () {
    'use strict';

    // 1. API Key Management
    const API_KEY_STORAGE_KEY = 'TORN_MARKET_API_KEY';

    function getApiKey() {
        return GM_getValue(API_KEY_STORAGE_KEY, '');
    }

    function setApiKey(key) {
        GM_setValue(API_KEY_STORAGE_KEY, key ? key.trim() : '');
    }

    function promptForApiKey() {
        const currentKey = getApiKey();
        const newKey = window.prompt("Enter your Torn API Key (API v2):", currentKey);
        if (newKey !== null) {
            setApiKey(newKey);
            if (newKey.trim()) {
                alert("API key saved successfully.");
            } else {
                alert("API key removed.");
            }
        }
        return getApiKey();
    }

    GM_registerMenuCommand("Change / Enter Torn API Key", promptForApiKey);

    // Format number to currency format (e.g., 15000 -> $15,000)
    function formatMoney(amount) {
        return '$' + Number(amount).toLocaleString('en-US');
    }

    // 2. UI Templates & Styles
    let svgIconCounter = 0;

    // Each button needs a unique gradient id to avoid duplicated DOM ids.
    function createSvgIcon() {
        const gradientId = `customPriceArrowGrad-${svgIconCounter++}`;
        return `
        <svg viewBox="0 0 11 16" width="11" height="16" class="shadow___sBfrJ" style="fill: currentColor; vertical-align: middle;">
            <defs>
                <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff" />
                    <stop offset="100%" stop-color="#a0a0a0" />
                </linearGradient>
            </defs>
            <path fill="url(#${gradientId})" d="M5.5 13L0 6.5h3.5V1h4v5.5H11L5.5 13z"/>
        </svg>
    `;
    }

    function createPriceButton() {
        const btn = document.createElement('span');
        // Retain exact native input button classes
        btn.className = 'input-money-symbol custom-price-btn';
        btn.title = 'Click to fetch market prices (Min / Mid / Max)';
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.style.cursor = 'pointer';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.marginRight = '0px'; // Remove gap between button and input
        btn.style.userSelect = 'none';
        btn.style.borderRight = 'none'; // Seamless integration with input border
        btn.innerHTML = createSvgIcon();
        return btn;
    }

    // 3. Fetch Market Prices & Calculate Min / Mid / Max via API v2
    async function fetchMarketStats(itemId) {
        let apiKey = getApiKey();
        if (!apiKey) {
            apiKey = promptForApiKey();
            if (!apiKey) {
                throw new Error("No API key provided. Action canceled.");
            }
        }

        // Request a higher limit (500) to collect a representative market sample.
        // The API key is sent via the Authorization header only (never in the URL).
        const url = `https://api.torn.com/v2/market/${itemId}?selections=itemmarket&limit=500`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 15000,
                headers: {
                    "Authorization": `ApiKey ${apiKey}`
                },
                onload: function (response) {
                    if (response.status && response.status !== 200) {
                        return reject(new Error(`Torn API request failed (HTTP ${response.status}).`));
                    }
                    try {
                        const data = JSON.parse(response.responseText);

                        if (data.error) {
                            if (data.error.code === 2) {
                                setApiKey('');
                                return reject(new Error(`Torn API Error: ${data.error.error || data.error.message}. Your API key was removed — please enter a new one.`));
                            }
                            return reject(new Error(`Torn API Error: ${data.error.error || data.error.message}`));
                        }

                        const marketData = data.itemmarket;
                        const listings = marketData?.listings || marketData;

                        if (!listings) {
                            return reject(new Error("No market listings found for this item."));
                        }

                        const itemsList = Array.isArray(listings) ? listings : Object.values(listings);

                        // Extract total listings count from API v2 metadata
                        const totalCount = data._metadata?.total || marketData?.pagination?.total || itemsList.length;

                        // Extract valid prices
                        const prices = itemsList
                            .map(item => Number(item.price ?? item.cost))
                            .filter(price => !isNaN(price) && price > 0)
                            .sort((a, b) => a - b);

                        if (prices.length === 0) {
                            return reject(new Error("No valid prices found on the market."));
                        }

                        // Calculate Min, Mid (Median), and Max
                        const min = prices[0];
                        const max = prices[prices.length - 1];

                        let mid;
                        const half = Math.floor(prices.length / 2);
                        if (prices.length % 2 !== 0) {
                            mid = prices[half];
                        } else {
                            mid = Math.round((prices[half - 1] + prices[half]) / 2);
                        }

                        resolve({ min, mid, max, count: totalCount });
                    } catch (err) {
                        reject(new Error("Error parsing response from API v2."));
                    }
                },
                onerror: function () {
                    reject(new Error("Network connection error."));
                },
                ontimeout: function () {
                    reject(new Error("Request timed out. Please try again."));
                }
            });
        });
    }

    // 4. React Input Update Trigger
    function setReactInputValue(inputElement, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputElement, value);

        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 5. Extract Item ID from Row
    function getItemIdFromRow(row) {
        const img = row.querySelector('img.torn-item') || row.querySelector('img[src*="/images/items/"]');
        if (img) {
            const match = img.src.match(/\/images\/items\/(\d+)\/large\.png/);
            if (match && match[1]) {
                return match[1];
            }
        }

        const infoBtn = row.querySelector('[class*="viewInfoButton"]');
        if (infoBtn) {
            const ariaControls = infoBtn.getAttribute('aria-controls') || '';
            const match = ariaControls.match(/wai-inventoryManager-itemInfo-(\d+)-/);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }

    // 6. Main UI Injection Function
    function injectButtons() {
        const moneyGroups = document.querySelectorAll('[class*="priceInputWrapper"] .input-money-group');

        moneyGroups.forEach(group => {
            if (group.classList.contains('custom-pricer-attached')) {
                return;
            }

            group.classList.add('custom-pricer-attached');

            const btn = createPriceButton();

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const row = group.closest('[class*="itemRow"]');
                if (!row) {
                    alert("Could not identify item row.");
                    return;
                }

                const itemId = getItemIdFromRow(row);
                if (!itemId) {
                    alert("Could not extract Item ID from UI.");
                    return;
                }

                const priceInput = group.querySelector('input[placeholder="Price"][data-testid="legacy-money-input"]') ||
                                   group.querySelector('input[placeholder="Price"]:not([type="hidden"])');

                if (!priceInput) {
                    alert("Price input element not found.");
                    return;
                }

                const originalOpacity = btn.style.opacity;
                btn.style.opacity = '0.4';
                btn.style.pointerEvents = 'none';

                try {
                    const stats = await fetchMarketStats(itemId);

                    // Set lowest price in input
                    setReactInputValue(priceInput, stats.min);

                    // Build formatted tooltip string
                    const tooltipText = `Market (${stats.count} listings) | Min: ${formatMoney(stats.min)} | Mid: ${formatMoney(stats.mid)} | Max: ${formatMoney(stats.max)}`;

                    // Apply tooltip to both the button and price input field
                    btn.title = tooltipText;
                    priceInput.title = tooltipText;

                } catch (err) {
                    alert(err.message);
                } finally {
                    btn.style.opacity = originalOpacity || '1';
                    btn.style.pointerEvents = 'auto';
                }
            });

            // Keyboard accessibility: Enter / Space triggers the same action
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });

            // Insert at the start of the money group container
            group.insertBefore(btn, group.firstChild);
        });
    }

    // 7. Dynamic DOM MutationObserver (throttled via requestAnimationFrame)
    let injectScheduled = false;

    function scheduleInjectButtons() {
        if (injectScheduled) {
            return;
        }
        injectScheduled = true;
        requestAnimationFrame(() => {
            injectScheduled = false;
            injectButtons();
        });
    }

    const observer = new MutationObserver(scheduleInjectButtons);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    injectButtons();
})();
