// Settings
const debounceTime = 200; //ms

// State
var shiftDown = false;
var ctrlDown = false;
var lastRequestTime = new Date().getTime();
var lastCondition = null;
var lastSearchField = null;
var lastSuggestions = null;
var lastParseQuery = null;
var lastUnParseQuery = null;
var showKeywords = false;

// UI
var advancedSearchSuggestion = document.createElement('div')


var infoDiv = document.createElement('div');
infoDiv.style = "display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";
advancedSearchSuggestion.appendChild(infoDiv);

var header = document.createElement('div');
header.style = "display: flex; flex-direction: row; width: 100%";

var title = document.createElement('span');
title.innerHTML = 'Advanced Search'
title.style = "font-size: medium;";
header.appendChild(title);
var tip = document.createElement('span');
tip.innerHTML = 'Apply: (shift) + (enter) <br/> Suggestions: (ctrl) + (space)'
tip.style = "font-style: italic; font-size: medium; margin-left: auto; font-size: small; font-size: x-small; max-width: 150px;";
header.appendChild(tip);
infoDiv.appendChild(header);

var hint = document.createElement('span');
hint.innerHTML = 'Suggestions: ABC123, defge'
hint.style = "font-size: small; font-style: italic";
infoDiv.appendChild(hint);


var textContainer = document.createElement('div');
textContainer.style = "padding-top: 10px; color: rgb(15, 20, 25); font-size: 14px; font-weight: bold;  font-family: monospace;";
advancedSearchSuggestion.appendChild(textContainer);


advancedSearchSuggestion.style = 'display: flex; flex-direction: column; justify-content:left; padding: 15px; border-bottom: solid 1px rgb(235, 238, 240)';

async function addAllListeners() {
    var inserted = false;
    while (!inserted) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 sec
        const searchField = document.querySelector('[aria-label="Search query"]');
        if (searchField)
            inserted = true;
        else
            continue;

        getResult(searchField.value);
        if (lastSearchField === searchField)
            return;

        lastSearchField = searchField;
        searchField.addEventListener("keydown", event => {
            if (event.keyCode === 16) {
                shiftDown = true
                return;
            }
            if (event.keyCode === 17) {
                ctrlDown = true
                return;
            }

            if (event.keyCode === 13) {
                console.log('KEY DOWN ENTER')

                if (shiftDown) {
                    // Execute
                    lastParseQuery = parseTwitterQuery(lastCondition);
                    console.log(lastParseQuery);
                    lastUnParseQuery = searchField.value;
                    searchField.value = lastParseQuery;
                    event.stopImmediatePropagation();

                    /*event.stopPropagation();
                    event.preventDefault();
                    setTimeout(() => {
                        shiftDown = false;
                        const keyboardEvent = new KeyboardEvent('keydown', {
                            code: 'Enter',
                            key: 'Enter',
                            charKode: 13,
                            keyCode: 13,
                            view: window
                        });
                
                        document.dispatchEvent(keyboardEvent);
                    }, 1);*/
                }
                return;
            }
        });

        searchField.addEventListener("keyup", event => {
            if (event.keyCode === 16) {
                shiftDown = false
                return;
            }
            if (event.keyCode === 17) {
                ctrlDown = false
                return;
            }
            if (event.keyCode === 32) {
                // Space clicked, toggle keywords
                if (ctrlDown) {
                    showKeywords = !showKeywords;
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

            if (searchField.value == lastParseQuery) {
                searchField.value = lastUnParseQuery;
            }
            if (event.keyCode === 16) {
                shiftDown = false
                return;
            }

            if (event.isComposing || event.keyCode === 229) {
                return;
            }
            getResult(searchField.value);

        });

    }
}

addAllListeners(); // Starting point 1
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        // messages sent from background.js indicating site navigation, which requires readding listeners
        if (request.message === '__new_url_ql__') {
            addAllListeners();  // Starting point 2
        }
    });



// The search experience

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


// The Quantleaf Query API call
async function getResult(input) {
    if (!input)
        return null;
    const req = new XMLHttpRequest();
    const baseUrl = "https://api.query.quantleaf.com/translate";
    req.open("POST", baseUrl, true);
    req.setRequestHeader("x-api-key", "42a69926-7020-4e4c-a6df-200145ee2beb");
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
            lastCondition = body;
            injectAsOption(body)

        }
    }
}

// Injects advanced search UI as the first result element
function injectAsOption(responseBody) {
    lastCondition = (responseBody.query?.length > 0 && responseBody.query[0].condition) ? responseBody.query[0].condition : null;
    const readableQuery = lastCondition ? parseReadableQuery(lastCondition) : null;

    const suggestObjects = responseBody.suggest;
    const suggestLimit = 10;
    let suggestions = suggestObjects?.map(s => s.text.trim()).slice(0, Math.min(suggestObjects.length, suggestLimit)).join(', ');
    if (suggestObjects?.length > suggestLimit)
        suggestions += ', ...'
    lastSuggestions = suggestions;
    // Find the option list, and inject as first option
    const dropDownIdPrefix = 'typeaheadDropdown';
    for (let i = 1; i < 10; i++) {
        const dropDown = document.getElementById(dropDownIdPrefix + '-' + i);
        if (dropDown) {
            //iframe.src = chrome.runtime.getURL('suggestions/suggestions.html');
            if (readableQuery) {
                textContainer.innerHTML = readableQuery;
                printSuggestions();
                if (dropDown.lastChild != advancedSearchSuggestion && dropDown.firstChild != advancedSearchSuggestion) {
                    dropDown.prepend(advancedSearchSuggestion);
                }

            }
        }
    }
}

function printSuggestions() {
    if (showKeywords) {
        hint.innerHTML = 'Keywords: ' + lastSuggestions;

    }
    else {
        hint.innerHTML = '';
    }
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
            and.push(parseTwitterQuery(element, fieldCounter));
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
            console.log([...fieldInvalidComparators[comp.key]]);
            console.log(invalidComparators);
            console.log(comp);

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
                    console.log('--_>', comp.eq)
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
                }
            case dateKey:
                {
                    if (comp.eq) {
                        return `since: ${formatDate(comp.eq)} until:${formatDate(comp.eq)}`;
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
    if (field.domain[value]) // Enum domain!
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

