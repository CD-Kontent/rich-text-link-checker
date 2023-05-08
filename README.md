# Link Checker for Rich Text
v1.0

## Description

This is a tool to check external URLs in a Kontent.ai project.
It will scan a project for Content Types containing rich text elements, and then retrieve all Content Items of the identified types.
These will be scanned for any external URLs, which will then be tested to display a status code and response time to the user.

Text colour differentiates between URLs that are accessed successfully, that return errors, and that redirect. 

### Limitations

- Scans only one environment at a time.
- Detects links in rich text elements only.
- Detects links that have been properly configured through the UI or MAPI only (e.g., 'www.example.com' in text will NOT be detected, unless it has been formatted as a link).
- If no language codename is provided, will scan default language only.
- Works with Delivery REST API (and Preview) only.
- Does not work with Secure Access for Delivery API. If Secure Access is enabled, use a Preview API Key.

## Usage

Supply an Environment ID (required), Preview API Key (optional), and Language Codename (optional), in the provided form.

The tool will scan for URLs, and send them to a server to be tested, and display the responses on-screen in table form. Note that the server will 'stream' responses as each URL is checked, and these are rendered as they come. This avoids lengthy delays when there are many URLs to check, or when URLs respond slowly.

### Errors

*API Request Failed: 401*
This indicates an authentication request, please check the supplied API Key (and remember: this only works with Preview API Key)

*API Request Failed: 404*
This indicates a bad request to the API. Please check the parameters you provided, particularly the Project ID.

## Tech Stack

- This tool was built primarily with HTML and vanilla JavaScript.
- Bulma was used for styling.
- The works on the Kontent.ai Delivery REST API.

## Planned Features

1. Result Pagination
Pagination of the results table is planned for a future update. Currently, results are rendered as they are returned from the server, rather than waiting for the complete data set (or server-side pagination). This conflicts with the usual client-side "show subset of complete data set" approach to pagination.