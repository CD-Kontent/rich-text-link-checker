// SECTION: Parameters
// This section contains functions and global variables that govern the parameters of the
// tool.

// Prevent screen refresh to display results without redirecting to new page. Clears page
// of results of previous operations.
const submit = document.getElementById("submit");
submit.addEventListener("click", (event) => {
  event.preventDefault();
  const messages = document.getElementById("message");
  messages.innerHTML = "";
  const table = document.getElementById("results");
  table.innerHTML = "";
});

// Users can provide a Preview API Key. API requests will need to be altered conditionally
// based on this: the API key will need to be included as a Bearer token (if included),
// and the request endpoint will need to be changed to the Preview API.

// Empty header object can be harmlessly included in requests, or updated with API key.
const headers = {};

// Base URL for Delivery API.
const kontentURL = "deliver.kontent.ai";

// This is the variable we will actually use when calling the endpoint. If a PreviewAPI
// Key is provided, this will be updated to the Preview API address
let endpointURL = kontentURL;

// Displayed results will include a link to open the Kontent.ai UI at the appropriate
// content item. This variable will house the base URL for this, created below based
// on user input.
let linkToContentItem = "";

// Handles user form inputs and updates global variables accordingly
async function processUserInputs() {
  let input = document.getElementById("details");
  const project = input.elements[0].value;
  // Language is an optional input, but passed as a parameter in a later function, so needs
  // to be declared now. A language filter will be conditionally added to a later API
  // request if language is "truthy".
  const language = input.elements[1].value || "";

  // Configures "base" API URL based on presence/absence of supplied Preview API key
  const previewKey = input.elements[2].value;
  if (previewKey) {
    headers["Authorization"] = `Bearer ${previewKey}`;
    endpointURL = `https://preview-${kontentURL}/${project}`;
  } else {
    endpointURL = `https://${kontentURL}/${project}`;
  }

  try {
    // Checks for a supplied language codename and queries API for system ID of the
    // language if present - this ID is needed to build the link to content items in
    // the Kontent.ai app
    const languageID = language
      ? await getLanguageID(language)
      : "00000000-0000-0000-0000-000000000000";
    linkToContentItem = `https://app.kontent.ai/${project}/content-inventory/${languageID}/content/`;
    return { language };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Returns internal system ID for the selected language. This is used to create a
// link to the content item in the UI; with the added benefit of checking that
// the supplied codename is valid.
async function getLanguageID(languageCodename) {
  try {
    const languageInfo = await callAPI(
      `${endpointURL}/languages?system.codename=${languageCodename}`,
      "GET"
    );
    if (languageInfo.languages.length > 0) {
      return languageInfo.languages[0].system.id;
    } else {
      throw new Error("Language Codename appears to be invalid.");
    }
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(error.message);
  }
}

// SECTION: Flow control
// "Control" functions that govern the operation of the script.

// This is the main control function for the tool - it "does the thing", and
// attempts to handle failed states (no content types containing rich text
// elements/no external URLs found in project) gracefully
async function controlScript() {
  try {
    // check for supplied language codename - needed for "retrieve items" call
    const { language } = await processUserInputs();
    // checks for rich text elements in content types of the project
    const anyRichTextTypes = await checkTypes();
    // if none are found, alerts user; otherwise begins checking for external URLs
    if (anyRichTextTypes == "") {
      displayNotification(
        "No Content Types with Rich Text Elements found.",
        "is-warning"
      );
      throw new Error("Process Aborted");
    }
    const anyURLs = await findExternalLinks(anyRichTextTypes, language);
    // if no external URLs found, alerts user; otherwise sends URLs to server
    // for testing
    if (anyURLs[0].length == 0) {
      displayNotification("No external URLs found", "is-warning");
      throw new Error("Process Aborted")
    } else {
      displayNotification(`${anyURLs[1]} URLs found for testing`, "is-success");
      await testLinks(anyURLs[0]);
    }
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    displayNotification(`${error.message}`, "is-danger");
  }
}

// Retrieves content types for the project and checks for any containing rich
// text elements. These are grouped together as the "fail state" for either
// (no content types, or no rich text elements, being found) are functionally
// identical - there are no rich text elements found that could have external
// URLs to check for, so there is no point attempting to retrieve content items.
async function checkTypes() {
  try {
    const typesInProject = await getTypes();
    const contentTypesWithRichText = await findRichTextTypes(typesInProject);
    return contentTypesWithRichText;
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(error.message);
  }
}

// Retrieves content items of the types identified previously as containing
// rich text elements, then searches the content of the rich text elements
// for external URLs. As above, these are grouped together due to outcomes of
// "fail states" are the same: whether no items are returned, or no external
// URLs are found, there are no URLs to send to the server for testing.
async function findExternalLinks(types, language) {
  try {
  const richTextItems = await getItems(types, language);
  const foundURLs = await findURLsInRichText(richTextItems);
  return foundURLs;
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(error.message);
  }
}

// SECTION: Operations
// These handle the various functional operations of the tool - sending,
// receiving and processing data, etc.

// Retrieves all Content Types in the project. To do this, the response
// from the API needs to be checked for a "next page" URL, and this
// URL queried, until no "next page" URL is returned (indicating no
// further content types are left to be retrieved).
async function getTypes() {
  const retrievedTypes = [];
  let isNextPage = true;

  try {
    while (isNextPage) {
      let response = await callAPI(
        `${endpointURL}/types?limit=2000&skip=0`,
        "GET"
      );
      retrievedTypes.push(response.types);
      if (response.pagination.next_page == "") {
        isNextPage = false;
      } else {
        endpoint = response.pagination.next_page;
      }
    }
    return retrievedTypes.flat();
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(
      `Error occured retrieving your content types: "${error.message}"`
    );
  }
}

// Searches a provided list of Content Types for those that contain rich text elements,
// returning a list of matches. Line-by-line comments included as this is heavily
// refactored from my initial implementation, using more elegant but less familiar
// approaches that I'm more likely to forget.
async function findRichTextTypes(types) {
  try {
    const richTextTypes = types
      // Filter provided types by (contd)
      .filter((type) => {
        // their elements that meet the criteria (contd)
        return Object.values(type.elements).some((element) => {
          // of having rich text type. The extra 'return' here stops the search after the
          // rich text element is found - we only need to know if it has ANY, not how many
          return element.type === "rich_text";
        });
      })
      // Map a new array from the codenames of the types that met filtering criteria above
      .map((type) => {
        return type.system.codename;
      });
    // Return this new array, converted to a string (to be easily included in API call)
    return richTextTypes.toString();
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(
      `Error occurred searching your content types: ${error.message}`
    );
  }
}

// Retrieves all Content Items of the identified Content Types. As with
// retrieving Content Types, the API response needs to be checked for a
// "next page" URL, etc.
async function getItems(types, language) {
  const retrievedItems = [];
  let isNextPage = true;
  // Configure API call parameters + filters
  let endpoint = setCallParameters(types, language);

  try {
    while (isNextPage) {
      let response = await callAPI(endpoint, "GET");
      retrievedItems.push(response.items);
      if (response.pagination.next_page == "") {
        isNextPage = false;
      } else {
        endpoint = response.pagination.next_page;
      }
    }
    return retrievedItems.flat();
  } catch (error) {
    // log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(
      `Error occured retrieving your content items: ${error.message}`
    );
  }
}

// Sets appropriate filtering and parameters for request to Items endpoint of API
function setCallParameters(types, language) {
  let apiEndpoint = `${endpointURL}/items?system.type[in]=${types}`;
  if (language) {
    apiEndpoint += `&system.language=${language}`;
  }
  apiEndpoint += "&depth=0&limit=2000&skip=0";

  return apiEndpoint;
}

// Searches an array (of returned Content Items) for elements of the rich text type, then
// searches those for external links. Returns array of objects organising detected URLs
// by the Content Item in which they're found, with extra parameters to store the
// response status and response time for each URL.
function findURLsInRichText(inputArray) {
  // Records the number of URLs found, which will be reported to user.
  numURLsFound = 0;
  result = [];
  // For each item in the provided array...
  inputArray.forEach((item) => {
    // ...create an array to contain all the links found in the item...
    const urls = [];
    // ...iterate through the elements of the item to find rich text types...
    let itemElements = Object.entries(item.elements);
    itemElements.forEach((thisElement) => {
      if (thisElement[1].type === "rich_text") {
        // ...check them for links...
        const urlsFound = extractURLs(thisElement[1].value);
        if (urlsFound !== null) {
          urlsFound.forEach((url) => {
            // ...remove rich text formatting, leaving just the URL...
            const extractedUrl = url.split('"')[1];
            // extractedURLs.push(extractedUrl);
            // ...and create an object for each URL so that the response and response
            // time can be stored alongside the URL (responses to be tested later).
            urls.push({
              URL: extractedUrl,
              Response: "",
              ResponseTime: "",
            });
            numURLsFound++;
          });
        }
      }
    });

    // Then create an object to group URLs by Content Item for easier reference, rather than
    // leaving a separate object for each URL with replicated content item name.
    if (urls.length > 0) {
      const contentItemURLs = {
        Name: item.system.name,
        URLs: urls,
        systemID: item.system.id,
      };
      // Finally, add these items to the response.
      result.push(contentItemURLs);
    }
  });
  return [result, numURLsFound];
}

// Sends the objects returned by findURLsInRichText() to the server as JSON and handles
// the response. These will be sent in "chunks" of a set size. This avoids exceeding request
// size limits for large projects, while decreasing network traffic compared to sending
// one-at-a-time.

// The server is configured to send results in 'chunks' to reduce wait times for large
// projects; these chunks are rendered as they're received.
// Currently this is configured to a "per content item" basis, not "per URL"
async function testLinks(objects) {
  try {
    toggleProgress("on");
    // Set number of URLs to be sent per chunk
    const chunkSize = 50;
    // Calculates number of chunks to be sent
    const numberOfChunks = Math.ceil(objects.length / chunkSize);
    for (let index = 0; index < numberOfChunks; index++) {
      const chunk = objects.slice(index * chunkSize, (index + 1) * chunkSize);

      const res = await fetch("http://localhost:3000/ping", {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        displayNotification(
          `Unexpected error occured communicating with server. Status code: ${res.status}`,
          "is-danger"
        );
      }

      // Handles the streamed/chunked response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let response = "";
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value === null) {
          break;
        }
        response += decoder.decode(value);
        done = readerDone;

        // Render responses
        const lines = response.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
          const item = JSON.parse(lines[i]);
          settingTheTable([item]);
        }
        response = lines[lines.length - 1];
      }
    }
  } catch (error) {
    // log the error to the console for debugging purposes
    console.error(error);
    // inform the user of the error
    displayNotification(
      `Error occured communicating with server: ${error.message}`,
      "is-danger"
    );
  }
  toggleProgress("off");
}

// This renders the response from the server in a table format
function settingTheTable(input) {
  const table = document.getElementById("results");

  const headings = [
    "Content Item Name",
    "URL Found",
    "Response",
    "Response Time",
  ];

  if (!table.hasChildNodes()) {
    const headingsRow = `<tr>${headings
      .map((heading) => `<th>${heading}</th>`)
      .join("")}</tr>`;
    table.insertAdjacentHTML("beforeend", headingsRow);
  }

  const rows = input.flatMap((item) =>
    item.URLs.map((url) => {
      return `<tr class=${urlColour(url)}>
              <td><a target="_blank" rel="noreferrer" href='${linkToContentItem}${
        item.systemID
      }'>${item.Name}</a></td>
              <td>${url.URL}</td>
              <td>${url.Response}</td>
              <td>${url.ResponseTime}</td>
            </tr>`;
    })
  );

  table.insertAdjacentHTML("beforeend", rows.join(""));
}

// SECTION: Helper functions

// Compares a string against a regex pattern to find URLs
function extractURLs(text) {
  const regex = /<a([^>]+)href="(https?:\/\/.+?)"[^>]*>(.+?)<\/a>/g;
  return text.match(regex);
}

// Displays messages and notifications to user
function displayNotification(message, notificationType) {
  const notificationArea = document.getElementById("message");
  const notification = document.createElement("p");
  notification.textContent = message;
  notification.classList.add(
    "notification",
    `${notificationType}`,
    "is-light",
    "mx-5"
  );
  notificationArea.appendChild(notification);
}

// Sends a request to Kontent.ai Delivery REST API  - currently only GET requests are
// needed but this is configurable to accomodate future changes.
// Server requests are different enough to be better handled separately, especially
// given there is currently only one.
async function callAPI(endpoint, requestMethod) {
  try {
    const res = await fetch(endpoint, {
      method: `${requestMethod}`,
      headers: headers,
    });
    // Since many errors will still count as a "success" for fetch(), they must be
    // handled here - they won't trigger the catch() block
    if (!res.ok) {
      // throw error to be handled by initiating function
      throw new Error(`API request failed: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    // Log error to console for debugging purposes
    console.error(error);
    // throw error to be handled by initiating function
    throw new Error(error.message);
  }
}

// Sets table colouration by adding Bulma class, according to response data
function urlColour(url) {
  if (url.Redirected) {
    return "has-text-warning";
  } else if (url.Error) {
    return "has-text-danger";
  } else {
    return "has-text-primary";
  }
}

// Toggles "in progress" bar on/off
function toggleProgress(state) {
  const progressBar = document.getElementById("progress");
  switch (state) {
    case "on":
      progressBar.hidden = false;
      break;
    case "off":
      progressBar.hidden = true;
      break;
  }
}
