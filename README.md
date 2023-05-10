# Link Checker for Rich Text
v1.1

## Description

This is a tool to check external URLs in a Kontent.ai project.
It will scan a particular environment for Content Types containing rich text elements, and then retrieve all Content Items of the identified types.
These will be scanned for any external URLs, which will then be tested to display a status code and response time to the user.

Text colour differentiates between URLs that are accessed successfully, that return errors, and that redirect. 

### Limitations

- Scans only one environment at a time.
- Detects links in rich text elements only.
- Detects links that have been properly configured through the UI or MAPI only (e.g., 'www.example.com' in text will NOT be detected, unless it has been formatted as a link).
- If no language codename is provided, will scan default language only.
- Works with Delivery REST API (and Preview) only.
- Does not work with Secure Access for Delivery API. If Secure Access is enabled, use a Preview API Key.
- Invalid inputs in any of the input fields will result in failure (e.g., there is no resiliency feature to default to normal Delivery API if Preview API Key is invalid - the Preview API will be called and the request will fail).
- There is no validation on the input fields. Environment IDs and API Keys are complex strings and I don't have access to the algorithms governing them; and language codenames can be configured by users, making them unpredictable.
- Results do not persist between operations - beginning a new scan will remove the results of any previous scans.

### Features

#### Incremental Table Pagination
The prototype of this tool presented results to the user in a table that was rendered incrementally, as results are returned from the server. This was to reduce the wait time for initial results caused by longer response times, timeouts, or retries for certain URLs. Waiting for every URL to tested, and the responses returned, would quickly lead to a lengthy wait for the user to see any results from their scan.

Rendering results one-at-a-time was an adequate solution throughout most of development, working with small test projects. However, when testing on larger projects, this quickly become unmanageable, as the table could contain hundreds, or thousands, of rows added. While paginating large sets like this would typically be handled server-side, by returning subsets of data representing a table "page", this would reintroduce the possibility of increased wait times (and wouldn't provide the opportunity to learn something new while developing the tool).

The obvious approach to client-side pagination would be to wait for the entire data set before dividing it into pages, however this had already been deemed unsuitable - waiting for everything to be tested was the original problem being addressed!

The current behaviour is a mix of both incremental rendering and pagination. Results are rendered one-at-a-time as they are returned by the server, up to a certain threshold. As enough results are returned to render a "full" page (determing by an "items per page" value), a page number is added to the screen for the user to navigate. This is effectiely an incremental approach to pagination; from the user perspective pages are added one-at-a-time as the results are returned.

This may not necessarily be the most "performant" approach, particularly on client devices with limited resources. Smilarly, the "functional" metric of how long a user waits could easily be impacted by the added wait times from more network requests introduced by server-side pagination, particularly for users with poor network speeds. 

This may warrant further investigation in the future, but for the very limited scope of this project, the current approach currently seems sufficient.

### Issues

The code for this tool currently wants a lot of optimisation. While the tool *works,* there are varying approaches to naming functions/variables/etc., inconsistent levels of abstraction, varying approaches to similar functions (e.g., `for` being used to do a certain thing in one function, and `while` to do the same thing in another), too many global variables, etc.

Some sections of code are old as sin, and have been streamlined, refactored, and refined progressively over the course of development; while others have been jammed in sideways to fix an issue or get a feature to work *right now.*

The plan is to improve this over time, but no promises are being offered.

## Usage

Supply an Environment ID (required), Preview API Key (optional), and Language Codename (optional), in the provided form.

The tool will scan for URLs, and send them to a server to be tested, and display the responses on-screen in table form.

### API Errors

If the Kontent.ai API returns an error; a message will be displayed including:
*API Request Failed: xxx,* where "xxx" is a status code.
For help understanding these errors, please refer to [the Delivery API Reference materials.](https://kontent.ai/learn/reference/openapi/delivery-api/#tag/Errors)

In the particular case of a `404` error (Not Found), this is likely due to an incorrect Environment ID.

## Tech Stack

- This tool was built primarily with HTML and vanilla JavaScript.
- Bulma was used for styling.
- The works on the Kontent.ai Delivery REST API.

## Planned Features

- ~~** Result Pagination:**~~

Implemented v1.1
Pagination of the results table is planned for a future update. Currently, results are rendered as they are returned from the server, rather than waiting for the complete data set (or server-side pagination). This conflicts with the usual client-side "show subset of complete data set" approach to pagination.

- **Configurable "Items per page"**

The number of items displayed per page in tabulated results is currently hard-coded. Future releases could include the option for the user to set this.

- **Abort Scan**

Currently there is no way for to stop a scan once begun. Refreshing or closing the browser tab will, of course, end the user interaction with the scan; but currently the server will continue processing the request.
This is something of a "worst of both worlds" situation, as there is no way for the user to re-establish the connection and accessing the results of the server process. Ending the server processes when a client action should reasonably be expected to terminate the entire process a high-priority inclusion for future updates. This would also make possible the inclusion of an "End Scan" button for the user.

## Notes

### Environment vs Project
While coding this, Kontent.ai moved towards greater distiction between Projects and Environments, and what was once called a Project ID was changed to (the more accurate) Environment ID.
I've changed the user-facing references to Environment ID, but there are still references to "project" in the code that should be understood as "environment."