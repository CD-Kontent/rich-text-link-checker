// None of this works yet

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

async function makeRequest(url) {
  try {
    let startTime = Date.now();
    const response = await axios.get(`${url}`);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    isRedirected = (response.request.res.responseUrl !== url)
    return [response.status, responseTime, isRedirected, false];
  } catch (error) {
    if (error.response) {
      return [error.response.status, 'Not Calculated', false, true]
    } else {
      return [500, 'None - Unexpected Internal Error', false ,true]
    }
  }
}

app.post("/ping", async (req, res) => {
  const items = req.body;
  console.log("Received items:", items);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Transfer-Encoding": "chunked",
    Trailer: "Content-MD5",
  });
  res.flushHeaders();
  for (const item of items) {
    console.log(item.URLs);
    for (const url of item.URLs) {
      const responseInfo = await makeRequest(url.URL);
      url.Response = responseInfo[0];
      url.ResponseTime = responseInfo[1]
      url.Redirected = responseInfo[2]
      url.Error = responseInfo[3];
    }
    console.log("Sending response for item:", item);
    res.write(JSON.stringify(item) + "\n");
  }
  res.addTrailers({
    "Content-MD5": "<md5-checksum>",
  });
  res.end();
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
