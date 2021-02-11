// Settings
import { QueryResponse } from '@quantleaf/query-request';
import { ConditionAnd, ConditionCompare, ConditionElement, Unknown } from '@quantleaf/query-result';
const api = 'https://api.query.quantleaf.com';
const apiKey = fetch(api + '/auth/key/demo').then((resp) => resp.text())

// State
var ctrlDown = false;
var lastCondition:ConditionElement|undefined;
var lastSearchField:HTMLInputElement;
var lastSuggestions:string|undefined;
var lastParseQuery:string|undefined;
var lastUnParseQuery:string;
var showKeywords = false;

// UI
var advancedSearchSuggestion = document.createElement('div');
advancedSearchSuggestion.addEventListener("click", () => {
    alert("Press 'Enter' to trigger Advanced Search");
    insertHidden();
});

var infoDiv = document.createElement('div');
infoDiv.style.cssText = "display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";
advancedSearchSuggestion.appendChild(infoDiv);

var header = document.createElement('div');
header.style.cssText = "display: flex; flex-direction: row; width: 100%";

var title = document.createElement('span');
title.innerHTML = 'Advanced Search'
header.appendChild(title);
var tip = document.createElement('span');
const showKeyswWordsHTML = 'Show keywords <br/> (ctrl) + (space)';
const hideKeyswWordsHTML = 'Hide keywords <br/> (ctrl) + (space)';
tip.innerHTML = showKeyswWordsHTML;

tip.style.cssText = "line-height: 10px; font-style: italic; margin-left: auto; font-size: small; font-size: xx-small; max-width: 150px;";
header.appendChild(tip);
infoDiv.appendChild(header);

var hint = document.createElement('span');
hint.innerHTML = ''
hint.style.cssText = "font-size: small; font-style: italic";
infoDiv.appendChild(hint);


var textContainer = document.createElement('div');
advancedSearchSuggestion.appendChild(textContainer);

const setDynamicStyle = () => {
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
    textContainer.style.cssText = `white-space: pre-wrap; word-wrap: break-word;padding-top: 10px;  font-size: ${fontSize}; font-weight: bold;  font-family: monospace; ${colorStyle}`
    title.style.cssText = `font-size: ${fontSize}; height: 20px  ${colorStyle}`;
    advancedSearchSuggestion.style.cssText = `display: flex; flex-direction: column; justify-content:left; padding: 15px; border-bottom: solid 1px ${borderColorString};  ${colorStyle}`;

}

const getColorMode = () => {
    let color = window.getComputedStyle(document.body).getPropertyValue('background-color')
    var colors = convertColor(color);
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

const debounce = <T extends (...args: any[]) => any>(
    callback: T,
    waitFor: number
  ) => {
    var timeout = null;
    return (...args: Parameters<T>): ReturnType<T> => {
      let result: any;
      clearTimeout(timeout as any as number);
      timeout = setTimeout(() => {
        result = callback(...args);
      }, waitFor) as any;
      return result;
    };
};




const getFontSize = () => {
    return window.getComputedStyle(document.getElementById('react-root') as Element).getPropertyValue('font-size')

}

// Add listeners for the search field, and set colors for styling (depending on color mode, light, dim, dark)
const  initialize = async() => {
    var inserted = false;
    while (!inserted) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 sec
        const searchField = document.querySelector('[aria-label="Search query"]') as HTMLInputElement;
        if(lastSearchField == searchField)
        {
            inserted = true;
            break;
        }

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
            debounce(() => {
               
                getResult((event?.target as any).value);
            }, 201)();
        });

        searchField.addEventListener("click", () => {
            if (searchField.value && (( (lastParseQuery && searchField.value?.startsWith(lastParseQuery)) || lastParseQuery?.startsWith(searchField.value)) && !lastUnParseQuery?.startsWith(lastParseQuery) && !lastParseQuery?.startsWith(lastUnParseQuery))) {
                insertText(lastUnParseQuery, true);
            }
            getResult(searchField.value);

        });

    }
}

MutationObserver = window.MutationObserver;

var observer = new MutationObserver(function() {
    initialize(); 
});

observer.observe(document, {
  subtree: true,
  attributes: true
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
            'zh-cn': "Simplified Chinese",
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
        description: [ "account", "from", "from account"],
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
const applyTwitterFormat = () => {
    lastParseQuery = parseTwitterQuery(lastCondition);
    if (lastParseQuery) // Only change value if we actually have parsed any query
    {
        insertText(lastParseQuery, true);
    }

    return lastParseQuery;
}


// The Quantleaf Query API call
const getResult = async(input:string) => {
    if (!input) {
        injectAsOption(input)
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
            injectAsOption(input,body)

        }
    }
}

const parseUnknownQuery = (input: string, unknown?: Unknown[]): ConditionCompare | undefined => {
    if (!unknown)
        return undefined;
    let startUnknown:ConditionCompare | undefined = undefined;
    let endUnkown:ConditionCompare | undefined = undefined;

    for (let i = 0; i < unknown.length; i++) {
        const u = unknown[i];
        if (u.offset == 0 && u.length > 2) {
            let value = input.substring(u.offset, u.offset + u.length);

            // Starts with unknown?
            if (value.startsWith("\"") && value.endsWith("\"")) {
                value = value.substring(1, value.length - 1);
            }
            startUnknown = {
                compare:
                {
                    key: allWordsKey,
                    eq: value
                }
            }

        }
        // ends with unnknown?
        if (u.offset + u.length == input.length) {
            let value = input.substring(u.offset, u.offset + u.length);
            if (value.startsWith("\"") && value.endsWith("\"")) {
                value = value.substring(1, value.length - 1);
            }
            endUnkown =  {
                compare:
                {
                    key: allWordsKey,
                    eq: value
                }
            }
        }
        if(startUnknown && endUnkown)
            break;
    }
    let unknownToUse = startUnknown;
    if(endUnkown?.compare?.eq)
    {
        if(!unknownToUse || !unknownToUse.compare.eq)
            unknownToUse = endUnkown;
        else //combine
        {
            // use end unknown if longer
            unknownToUse.compare.eq = String(unknownToUse?.compare.eq) + ' ' + String(endUnkown?.compare.eq)
        }
    }
    return unknownToUse;
}



// Injects advanced search UI as the first result element
const injectAsOption = (input:string, responseBody?: QueryResponse) => {

    

    // Handle unkown
    if(responseBody && responseBody.unknown)
    {
        const unknownAsQuery = parseUnknownQuery(input, responseBody.unknown);

        // Merge in unknown query if applicable, we only check top level for now
        if (responseBody && responseBody.query && responseBody.query.length > 0 &&  unknownAsQuery) {
            if ((responseBody.query[0].condition as ConditionAnd).and) {
                const and = responseBody.query[0].condition as ConditionAnd;
                if (!and.and.find((x) => (x as ConditionCompare).compare?.key == allWordsKey)) {
                    // Add the implicit query
                    and.and.push(unknownAsQuery);
                }
    
            }
            else if ((responseBody.query[0].condition as ConditionCompare).compare) {
                const comp = responseBody.query[0].condition as ConditionCompare;
                if (comp.compare.key != allWordsKey) {
                    const mergedCondition: ConditionAnd = {
                        and: [
                            comp,
                            unknownAsQuery
                        ]
                    }
                    responseBody.query[0].condition = mergedCondition;
                }
            }
        }
    }

    let queryIsTrivial = true;
    if(responseBody && responseBody.query)
    {
        lastCondition = (responseBody?.query?.length > 0 && responseBody.query[0].condition) ? responseBody.query[0].condition : undefined;
        if(lastCondition)
        {
            let compares:ConditionCompare[]  = (lastCondition as ConditionAnd).and as ConditionCompare[];
            if(!compares)
            {
                compares = [(lastCondition as ConditionCompare)];
            }
            queryIsTrivial = !(compares.find(x=>x.compare.key != allWordsKey) && compares.length > 0);
        }
    }
    else 
        lastCondition = undefined;
        

    const readableQuery = lastCondition ? parseReadableQuery(lastCondition) : null;

    const suggestObjects = responseBody?.suggest;
    const suggestLimit = 10;
    let suggestions = suggestObjects?.map(s => s.text.trim()).slice(0, Math.min(suggestObjects.length, suggestLimit)).join(', ');
    if (suggestObjects && suggestObjects?.length > suggestLimit)
        suggestions += ', ...'
    lastSuggestions = suggestions;
    // Find the option list, and inject as first option

    const dropDown = document.querySelector('[id^="typeaheadDropdown-"]');
    if (dropDown) {
        if (!readableQuery || queryIsTrivial) {
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

const insertHidden = () => { 
    insertText('‎', false) // trigger change 

}
const insertText = (text, clear) => {
    lastSearchField.focus();
    if (clear)
        lastSearchField.value = '';
    document.execCommand('insertText', false, text);
    lastSearchField.dispatchEvent(new Event('change', { bubbles: true })); // usually not needed
}


const printSuggestions = () => {
    if (showKeywords) {
        hint.innerHTML = 'Keywords: ' + lastSuggestions;

    }
    else {
        hint.innerHTML = '';
    }
}


const convertColor = (color) => {
    const rgbColors:number[] = [0,0,0];

    // rgb
    if (color[0] == 'r') {
        color = color.substring(color.indexOf('(') + 1, color.indexOf(')'));
        const parsedColors = color.split(',', 3);
        rgbColors[0] = parseInt(parsedColors[0]);
        rgbColors[1] = parseInt(parsedColors[1]);
        rgbColors[2] = parseInt(parsedColors[2]);
    }

    //hex
    else if (color.substring(0, 1) == "#") {

        const parsedColors:string[] = [];
        parsedColors[0] = color.substring(1, 3);  // redValue
        parsedColors[1] = color.substring(3, 5);  // greenValue
        parsedColors[2] = color.substring(5, 7);  // blueValue
        rgbColors[0] = parseInt(parsedColors[0], 16);
        rgbColors[1] = parseInt(parsedColors[1], 16);
        rgbColors[2] = parseInt(parsedColors[2], 16);
    }
    return rgbColors;
}



// Readable representation of the query object
const parseReadableQuery = (condition) => {
    if (condition.and) {
        const and:string[] = [];
        condition.and.forEach((element) => {
            and.push(parseReadableQuery(element));
        });
        return `${and.join('<br/>')}`;
    }
    if (condition.compare) {
        const compElements:string[] = [];
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
const parseTwitterQuery = (condition, fieldCounter = {}) => {
    if (!condition)
        return '';
    if (condition.and) {
        const and:string[] = [];
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
                        return `since:${formatDate(comp.eq)} until:${formatDate(dayAfter(comp.eq))}`;
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


const getAny = (object, keys) => {
    for (let i = 0; i < keys.length; i++) {
        if (object[keys[i]] != undefined)
            return object[keys[i]];

    }
    return null;
}
const ensurePrefix = (word, prefix) => {
    if (word.startsWith(prefix))
        return word;
    return prefix + word;
}
const wordSplit = (words) => {
    if (!words)
        return [];
    return words.replace(/,\s+/g, ",").split(/[\n,\s+]/)
}

const formatDate = (ms) => {
    return new Date(ms).toISOString().split('T')[0];;
}
const dayBefore = (ms) => {
    const date = new Date(ms);
    date.setDate(date.getDate() - 1);
    return date.getTime();
}

const dayAfter = (ms) => {
    const date = new Date(ms);
    date.setDate(date.getDate() + 1);
    return date.getTime();
}
const formatValue = (key, value) => {
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
const firstDescription = (desc) => {
    return Array.isArray(desc) ? desc[0] : desc
}

