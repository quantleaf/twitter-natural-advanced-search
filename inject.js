// Settings
const debounceTime = 200; //ms
const api = 'https://api.query.quantleaf.com';
const apiKey = fetch(api + '/auth/key/demo').then((resp) => resp.text())

// State
var ctrlDown = false;
var lastRequestTime = new Date().getTime();
var lastCondition = null;
var lastSearchField = null;
var lastSuggestions = null;
var lastParseQuery = null;
var lastUnParseQuery = null;
var lastResponseBody = null;
var showKeywords = false;

// UI
var advancedSearchSuggestion = document.createElement('div');
advancedSearchSuggestion.addEventListener("click", event => {
    alert("Press 'Enter' to trigger Advanced Search");
    insertHidden();
});

var infoDiv = document.createElement('div');
infoDiv.style = "display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";
advancedSearchSuggestion.appendChild(infoDiv);

var header = document.createElement('div');
header.style = "display: flex; flex-direction: row; width: 100%";

var title = document.createElement('span');
title.innerHTML = 'Advanced Search'
header.appendChild(title);
var tip = document.createElement('span');
const showKeyswWordsHTML = 'Show keywords <br/> (ctrl) + (space)';
const hideKeyswWordsHTML = 'Hide keywords <br/> (ctrl) + (space)';
tip.innerHTML = showKeyswWordsHTML;

tip.style = "line-height: 10px; font-style: italic; margin-left: auto; font-size: small; font-size: xx-small; max-width: 150px;";
header.appendChild(tip);
infoDiv.appendChild(header);

var hint = document.createElement('span');
hint.innerHTML = ''
hint.style = "font-size: small; font-style: italic";
infoDiv.appendChild(hint);


var textContainer = document.createElement('div');
advancedSearchSuggestion.appendChild(textContainer);

function setDynamicStyle() {
    const colorMode = getColorMode();
    const fontSize = getFontSize();
    let colorString = 'rgb(15, 20, 25);'
    let borderColorString = 'rgb(235, 238, 240);';
    if (colorMode == 'dark') {
        colorString = 'rgba(217,217,217,1.00)';
        borderColorString = 'rgb(47, 51, 54)';
    }
    else if (colorMode == 'dim') {
        colorString = 'rgb(255, 255, 255)';
        borderColorString = 'rgb(56, 68, 77)';
    }
    const colorStyle = `color: ${colorString};`
    textContainer.style = `white-space: pre-wrap; word-wrap: break-word;padding-top: 10px;  font-size: ${fontSize}; font-weight: bold;  font-family: monospace; ${colorStyle}`
    title.style = `font-size: ${fontSize}; height: 20px  ${colorStyle}`;
    advancedSearchSuggestion.style = `display: flex; flex-direction: column; justify-content:left; padding: 15px; border-bottom: solid 1px ${borderColorString};  ${colorStyle}`;

}

function getColorMode() {
    let color = window.getComputedStyle(document.body).getPropertyValue('background-color')
    colors = convertColor(color);
    let mean = 0;
    colors.forEach((color) => {
        mean += color;
    })
    mean = mean / 3;
    if (mean < 15)
        return 'dark'
    if (mean < 100)
        return 'dim'
    return 'light'
}


function getFontSize() {
    return window.getComputedStyle(document.getElementById('react-root')).getPropertyValue('font-size')

}

// Add listeners for the search field, and set colors for styling (depending on color mode, light, dim, dark)
async function initialize() {
    var inserted = false;
    while (!inserted) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 sec
        const searchField = document.querySelector('[aria-label="Search query"]');
        if (searchField)
            inserted = true;
        else
            continue;

        setDynamicStyle();
        getResult(searchField.value);
        if (lastSearchField === searchField)
            return;

        lastSearchField = searchField;
        lastSearchField.addEventListener("keydown", event => {

            if (event.keyCode === 17) {
                ctrlDown = true;
                return;
            }
            lastUnParseQuery = lastSearchField.value;

            if (event.keyCode === 13 && !ctrlDown) {

                // Execute
                insertHidden(); // Make sure a search will appear
                const newTwitterQuery = applyTwitterFormat();
                if (newTwitterQuery) {
                    event.stopImmediatePropagation();
                }
                return;
            }
        });

        searchField.addEventListener("keyup", event => {


            if (event.keyCode === 17) {
                ctrlDown = false;
            }

            if (event.keyCode === 32) {
                // Space clicked, toggle keywords
                if (ctrlDown) {
                    showKeywords = !showKeywords;
                    tip.innerHTML = showKeywords ? hideKeyswWordsHTML : showKeyswWordsHTML;
                    printSuggestions();
                }
                return;
            }
            if (event.isComposing || event.keyCode === 229) {
                return;
            }
            setTimeout(() => {
                if ((lastRequestTime + debounceTime) < new Date().getTime())
                    getResult(event.target.value);
            }, debounceTime + 1);

            lastRequestTime = new Date().getTime();
        });

        searchField.addEventListener("click", event => {
            if (searchField.value && ((searchField.value?.startsWith(lastParseQuery) || lastParseQuery?.startsWith(searchField.value)) && !lastUnParseQuery?.startsWith(lastParseQuery) && !lastParseQuery?.startsWith(lastUnParseQuery))) {
                insertText(lastUnParseQuery, true);
            }

            if (event.isComposing || event.keyCode === 229) {
                return;
            }
            getResult(searchField.value);

        });

    }
}

initialize(); // Starting point 1
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.message === '__new_url_ql__') {
            initialize();  // Starting point 2
        }
    });



// The search experience, code that define the translation to natural language to the generalized query structure
// and code that transform the generalized query structure into twitter query syntax

// We hard code the keys since we are to reference them on two places
const allWordsKey = 'all';
const anyOfKey = 'anyOf';
const exactPhraseKey = 'exactPhrase';
const dateKey = 'date';
const notAnyOfKey = 'nonOf';
const languageKey = 'language';
const hashTagsKey = 'hashtags';
const accountFromKey = 'accountFrom';
const accountToKey = 'accountTo';
const mentionAccountKey = 'mentionAccount';
const repliesFilterKey = 'repliesFilter';
const linksFilterKey = 'linksFilter';
const minimumLikesKey = 'minimumLikes';
const minimumRepliesKey = 'minimumReplies';
const minimumRetweetsKey = 'minimumRetweets';

// Some rules about twitter advanced filter
const maxFieldUsages = {
    [languageKey]: 1,
    [repliesFilterKey]: 1,
    [linksFilterKey]: 1,
    [minimumLikesKey]: 1,
    [minimumRepliesKey]: 1,
    [minimumRetweetsKey]: 1,
}
// Some fields should not have <= < comparators allowed
const fieldInvalidComparators = {
    [minimumLikesKey]: new Set(['lte', 'lt']),
    [minimumRepliesKey]: new Set(['lte', 'lt']),
    [minimumRetweetsKey]: new Set(['lte', 'lt']),
}

// Readables for UI error handling purposes
const comparatorReadable = {
    lte: '≤',
    lt: '<'
}

// Prevent bad code, with the lack of unit tests
Object.keys(fieldInvalidComparators).forEach((key) => {
    fieldInvalidComparators[key].forEach((value) => {
        if (!comparatorReadable[value])
            throw new Error(`No readable representation for ${key} found`)
    });

})

// The fields we want to search on
const fields = [
    {
        key: allWordsKey,
        description: ["content", "contains", "about", "all of"],
        domain: 'TEXT'
    },
    {
        key: exactPhraseKey,
        description: ["exact phrase", "exact match", "perfect match", "exact"],
        domain: 'TEXT'
    },
    {
        key: anyOfKey,
        description: ["any words", "any of"],
        domain: 'TEXT'
    },
    {
        key: notAnyOfKey,
        description: ["non of", "non of the words"],
        domain: 'TEXT'
    },

    {
        key: hashTagsKey,
        description: ["hashtags", "hashtag"],
        domain: 'TEXT'
    },
    {
        key: languageKey,
        description: "language",
        domain: {
            any: "Any language",
            ar: "Arabic",
            bn: "Bangla",
            eu: "Basque",
            bg: "Bulgarian",
            ca: "Catalan",
            hr: "Croatian",
            cs: "Czech",
            da: "Danish",
            nl: "Dutch",
            en: "English",
            fi: "Finnish",
            fr: "French",
            de: "German",
            el: "Greek",
            gu: "Gujarati",
            he: "Hebrew",
            hi: "Hindi",
            hu: "Hungarian",
            id: "Indonesian",
            it: "Italian",
            ja: "Japanese",
            kn: "Kannada",
            ko: "Korean",
            mr: "Marathi",
            no: "Norwegian",
            fa: "Persian",
            pl: "Polish",
            pt: "Portuguese",
            ro: "Romanian",
            ru: "Russian",
            sr: "Serbian",
            'zh-tw': "Simplified Chinese",
            sk: "Slovak",
            es: "Spanish",
            sv: "Swedish",
            ta: "Tamil",
            th: "Thai",
            'zh-tw': "Traditional Chinese",
            tr: "Turkish",
            uk: "Ukrainian",
            ur: "Urdu",
            vi: "Vietnamese",
        }
    },
    {
        key: accountFromKey,
        description: ["from", "account", "from account"],
        domain: 'TEXT'
    },
    {
        key: accountToKey,
        description: ["to", "to account"],
        domain: 'TEXT'
    },
    {
        key: mentionAccountKey,
        description: ["mentions", "mention"],
        domain: 'TEXT'
    },

    {
        key: linksFilterKey,
        description: ["links filter"],
        domain: {
            INCLUDE: ['include links'],
            ONLY_TWEETS_WITH_LINKS: ['only with links'],
            EXCLUDE: ['exclude links']
        }
    },
    {
        key: repliesFilterKey,
        description: ["replies filter"],
        domain: {
            INCLUDE: ['include replies and tweets'],
            INCLUDE_REPLIES_ONLY: ['only replies'],
            EXCLUDE: ['exclude replies']
        }
    },
    {
        key: minimumRepliesKey,
        description: ["minimum replies", "min replies"],
        domain: 'NUMBER'
    },
    {
        key: minimumLikesKey,
        description: ["minimum likes", "min likes", "min faves"],
        domain: 'NUMBER'
    },
    {
        key: minimumRetweetsKey,
        description: ["minimum retweets", "min retweets"],
        domain: 'NUMBER'
    },

    {
        key: dateKey,
        description: ["date"],
        domain: 'DATE'
    }
];

// Map by key
const fieldsByKey = {};
fields.forEach((f) => {
    fieldsByKey[f.key] = f;
});


// Translate to twitter query and set text to input
function applyTwitterFormat() {
    lastParseQuery = parseTwitterQuery(lastCondition);
    if (lastParseQuery) // Only change value if we actually have parsed any query
    {
        insertText(lastParseQuery, true);
    }

    return lastParseQuery;
}


// The Quantleaf Query API call
async function getResult(input) {
    if (!input) {
        injectAsOption(null)
        return null;

    }
    const key = await apiKey;
    if (!key)
        return null;
    const req = new XMLHttpRequest();
    const endpoint = api + "/translate";
    req.open("POST", endpoint, true);
    req.setRequestHeader("x-api-key", key);
    req.setRequestHeader('Content-type', 'application/json');
    req.send(
        JSON.stringify({
            text: input,
            schemas: [
                {
                    name: {
                        key: "twitter-search",
                        description: "Advanced search"
                    },
                    fields: fields
                }
            ],
            actions: {
                query: {},
                suggest: {}
            },
            options: {
                nestedConditions: false
            }
        })
    )
    req.onreadystatechange = function () { // Call a function when the state changes.
        if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
            const body = JSON.parse(req.response);
            lastResponseBody = body;
            injectAsOption(body)

        }
    }
}

// Injects advanced search UI as the first result element
function injectAsOption(responseBody) {

    lastCondition = (responseBody?.query?.length > 0 && responseBody.query[0].condition) ? responseBody.query[0].condition : null;
    const readableQuery = lastCondition ? parseReadableQuery(lastCondition) : null;

    const suggestObjects = responseBody?.suggest;
    const suggestLimit = 10;
    let suggestions = suggestObjects?.map(s => s.text.trim()).slice(0, Math.min(suggestObjects.length, suggestLimit)).join(', ');
    if (suggestObjects?.length > suggestLimit)
        suggestions += ', ...'
    lastSuggestions = suggestions;
    // Find the option list, and inject as first option

    const dropDown = document.querySelector('[id^="typeaheadDropdown-"]');
    if (dropDown) {
        if (!readableQuery) {
            textContainer.innerHTML = '';
            for (let i = 0; i < dropDown.children.length; i++) { // Remove child if exist
                const element = dropDown.children[i];
                if (element === advancedSearchSuggestion) {
                    dropDown.removeChild(advancedSearchSuggestion);
                    break;
                }
            }
        }
        else {
            textContainer.innerHTML = readableQuery;
            printSuggestions();
            if (dropDown.lastChild != advancedSearchSuggestion && dropDown.firstChild != advancedSearchSuggestion) {
                dropDown.prepend(advancedSearchSuggestion);
            }
        }



    }
}

function insertHidden() {
    insertText('‎', false) // trigger change 

}
function insertText(text, clear) {
    lastSearchField.focus();
    if (clear)
        lastSearchField.value = '';
    document.execCommand('insertText', false, text);
    lastSearchField.dispatchEvent(new Event('change', { bubbles: true })); // usually not needed
}


function printSuggestions() {
    if (showKeywords) {
        hint.innerHTML = 'Keywords: ' + lastSuggestions;

    }
    else {
        hint.innerHTML = '';
    }
}


function convertColor(color) {
    var rgbColors = new Object();

    // rgb
    if (color[0] == 'r') {
        color = color.substring(color.indexOf('(') + 1, color.indexOf(')'));
        rgbColors = color.split(',', 3);
        rgbColors[0] = parseInt(rgbColors[0]);
        rgbColors[1] = parseInt(rgbColors[1]);
        rgbColors[2] = parseInt(rgbColors[2]);
    }

    //hex
    else if (color.substring(0, 1) == "#") {

        rgbColors[0] = color.substring(1, 3);  // redValue
        rgbColors[1] = color.substring(3, 5);  // greenValue
        rgbColors[2] = color.substring(5, 7);  // blueValue
        rgbColors[0] = parseInt(rgbColors[0], 16);
        rgbColors[1] = parseInt(rgbColors[1], 16);
        rgbColors[2] = parseInt(rgbColors[2], 16);
    }
    return rgbColors;
}



// Readable representation of the query object
function parseReadableQuery(condition) {
    if (condition.and) {
        const and = [];
        condition.and.forEach((element) => {
            and.push(parseReadableQuery(element));
        });
        return `${and.join('<br/>')}`;
    }
    if (condition.compare) {
        const compElements = [];
        const comp = condition.compare;
        compElements.push(firstDescription(fieldsByKey[comp.key].description));
        if (comp.eq) {
            compElements.push(' = ' + formatValue(comp.key, comp.eq));
        }
        else if (comp.gt) {
            compElements.push(' > ' + formatValue(comp.key, comp.gt));
        }
        else if (comp.gte) {
            compElements.push(' ≥ ' + formatValue(comp.key, comp.gte));
        }
        else if (comp.lt) {
            compElements.push(' < ' + formatValue(comp.key, comp.lt));
        }
        else if (comp.lte) {
            compElements.push(' ≤ ' + formatValue(comp.key, comp.lte));
        }
        return compElements.join('');
    }
    return '';
}

// Parse to a query format that twitter understands
function parseTwitterQuery(condition, fieldCounter = {}) {
    if (!condition)
        return '';
    if (condition.and) {
        const and = [];
        condition.and.forEach((element) => {
            const compare = parseTwitterQuery(element, fieldCounter);
            if (compare?.length > 0)
                and.push(compare);
        });
        return `${and.join(' ')}`;
    }
    if (condition.compare) {
        const comp = condition.compare;
        const oneDescription = firstDescription(fieldsByKey[comp.key].description)
        fieldCounter[comp.key] = (fieldCounter[comp.key] ? fieldCounter[comp.key] : 0) + 1;
        if (maxFieldUsages[comp.key] != undefined && fieldCounter[comp.key] > maxFieldUsages[comp.key]) {
            alert(`You can only filter on ${oneDescription} ${maxFieldUsages[comp.key]} time(s)`)
        }

        if (fieldInvalidComparators[comp.key]) {
            const invalidComparators = [...fieldInvalidComparators[comp.key]].filter(comparator => comp[comparator] != undefined);
            if (invalidComparators.length > 0) {
                alert(`You can not filter on ${oneDescription} with a ${comparatorReadable[invalidComparators[0]]} comparator`)

            }

        }

        switch (comp.key) {
            case allWordsKey:
                {
                    return comp.eq
                }
            case exactPhraseKey:
                {
                    return `"${comp.eq}"`
                }
            case anyOfKey:
                {
                    return `(${wordSplit(comp.eq).join(' OR ')})`
                }
            case notAnyOfKey:
                {
                    return `${wordSplit(comp.eq).map(word => '-' + word).join(' ')}`
                }

            case hashTagsKey:
                {
                    return `(${wordSplit(comp.eq).map(word => ensurePrefix(word, '#')).join(' OR ')})`
                }
            case languageKey:
                {
                    return `lang:${comp.eq}`
                }
            case accountFromKey:
                {
                    return `(${wordSplit(comp.eq).map(account => ensurePrefix(account, '@')).map(account => 'from:' + account).join(' OR ')})`
                }
            case accountToKey:
                {
                    return `(${wordSplit(comp.eq).map(account => ensurePrefix(account, '@')).map(account => 'to:' + account).join(' OR ')})`
                }

            case mentionAccountKey:
                {
                    return `(${wordSplit(comp.eq).map(account => ensurePrefix(account, '@')).join(' OR ')})`
                }
            case minimumRepliesKey:
                {
                    return `min_replies:${getAny(comp, ['eq', 'gt', 'gte'])}`
                }
            case minimumLikesKey:
                {
                    return `min_faves:${getAny(comp, ['eq', 'gt', 'gte'])}`
                }
            case minimumRetweetsKey:
                {
                    return `min_retweets:${getAny(comp, ['eq', 'gt', 'gte'])}`
                }
            case repliesFilterKey:
                {
                    switch (comp.eq) {
                        case 'INCLUDE_REPLIES_ONLY':
                            {
                                return 'filter:replies'
                            }
                        case 'EXCLUDE':
                            {
                                return '-filter:replies'
                            }
                    }
                    return;
                }
            case linksFilterKey:
                {
                    switch (comp.eq) {
                        case 'ONLY_TWEETS_WITH_LINKS':
                            {
                                return 'filter:links'
                            }
                        case 'EXCLUDE':
                            {
                                return '-filter:links'
                            }
                    }
                    return;

                }
            case dateKey:
                {
                    if (comp.eq) {
                        return `since:${formatDate(comp.eq)} until:${formatDate(comp.eq)}`;
                    }
                    if (comp.lt) {
                        return `until:${formatDate(dayBefore(comp.lt))}`;
                    }
                    if (comp.lte) {
                        return `until:${formatDate(comp.lte)}`;
                    }
                    if (comp.gt) {
                        return `since:${formatDate(dayAfter(comp.gt))}`;
                    }
                    if (comp.gte) {
                        return `since:${formatDate(comp.gte)}`;
                    }
                    return;

                }
        }
    }
    return '';

}


function getAny(object, keys) {
    for (let i = 0; i < keys.length; i++) {
        if (object[keys[i]] != undefined)
            return object[keys[i]];

    }
    return null;
}
function ensurePrefix(word, prefix) {
    if (word.startsWith(prefix))
        return word;
    return prefix + word;
}
function wordSplit(words) {
    if (!words)
        return [];
    return words.replace(/,\s+/g, ",").split(/[\n,\s+]/)
}

function formatDate(ms) {
    return new Date(ms).toISOString().split('T')[0];;
}
function dayBefore(ms) {
    date = new Date(ms);
    date.setDate(date.getDate() - 1);
    return date.getTime();
}

function dayAfter(ms) {
    date = new Date(ms);
    date.setDate(date.getDate() + 1);
    return date.getTime();
}
function formatValue(key, value) {
    const field = fieldsByKey[key];
    if (field.domain == 'DATE') {
        return formatDate(value);
    }
    if (typeof field.domain != 'string' && field.domain[value]) // Enum domain!
    {
        let desc = firstDescription(field.domain[value]);
        if (desc)
            return desc;
    }

    return value;
}
function firstDescription(desc) {
    return Array.isArray(desc) ? desc[0] : desc
}

