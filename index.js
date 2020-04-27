const http = require('http')
const httpProxy = require('http-proxy')
const express = require('express')
const request = require('request')
const httpsrv = require('httpsrv')
const fs = require('fs')
const SECRET = /rpc-secret=(.*)/.exec(
	fs.readFileSync('aria2c.conf', 'utf-8')
)[1]
const ENCODED_SECRET = Buffer.from(SECRET).toString('base64')

const PORT = process.env.PORT || 1234
const app = express()
const proxy = httpProxy.createProxyServer({
	target: 'ws://localhost:6800',
	ws: true
})
const server = http.createServer(app)

// Proxy websocket
server.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head)
})

// Handle normal http traffic
app.use('/jsonrpc', (req, res) => {
	req.pipe(request('http://localhost:6800/jsonrpc')).pipe(res)
})
app.use(
	'/downloads/' + ENCODED_SECRET,
	httpsrv({
		basedir: __dirname + '/downloads'
	})
)
app.use('/ariang', express.static(__dirname + '/ariang'))
app.get('/', (req, res) => {
	res.send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css"
      rel="stylesheet"
    />

    <title>AriaStark</title>
  </head>
  <body class="bg-gray-900 font-mono text-gray-200">
    <div class="max-w-screen-lg mx-auto mt-16">
      <h1 class="text-center text-4xl">
        AriaStark
      </h1>
      <div class="flex flex-col justify-center mt-6">
        <input
          id="secret"
          class="w-1/2 self-center text-gray-800 px-2 py-1 text-2xl rounded-lg outline-none focus:shadow-outline"
          type="text"
          required
          placeholder="Secret"
        />
        <div
          id="secret_available"
          class="self-center mt-6 bg-red-400 w-1/2 rounded text-center text-lg py-1 hidden"
        >
          No Secret Provided
        </div>
        <button
          class="w-1/2 self-center text-center text-xl bg-gray-700 mt-6 px-2 py-1 rounded-lg outline-none focus:shadow-outline hover:bg-gray-600"
          id="panel"
        >
          AriaNg
        </button>
        <button
          class="w-1/2 self-center text-center text-xl bg-gray-700 mt-3 px-2 py-1 rounded-lg outline-none focus:shadow-outline hover:bg-gray-600"
          id="downloads"
        >
          Downloads
        </button>
      </div>
      <div
        class="text-center mt-6 text-blue-300 underline cursor-pointer"
        id="no_secret"
      >
        <span id="no_secret_text">
          Don't have a secret?
        </span>
        <div class="justify-center rounded-lg hidden" id="no_secret_gif">
          <img
            class="rounded-lg"
            src="no_sec.gif"
            alt="mother of dragon from game of throne saying deak with it for not having a secret to provide"
          />
        </div>
      </div>
    </div>

    <script>
      panel.onclick = function () {
        if (secret.value == "") {
          secret_available.style.display = "block";
        } else {
          open(
            `/ariang/#!/settings/rpc/set/wss/
            ${location.hostname}
            /443/jsonrpc/
            ${secret.value}`,
            "_blank"
          );
        }
      };
      downloads.onclick = function () {
        if (secret.value == "") {
          secret_available.style.display = "block";
        } else {
          open(`/downloads/${secret.value}/`);
        }
      };

      no_secret.onclick = function () {
        no_secret_text.style.display = "none";
        no_secret_gif.style.display = "flex";
      };
    </script>
  </body>
</html>


`)
})
server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`))

if (process.env.HEROKU_APP_NAME) {
	const readNumUpload = () =>
		new Promise((res, rej) =>
			fs.readFile('numUpload', 'utf-8', (err, text) =>
				err ? rej(err) : res(text)
			)
		)
	const APP_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`
	const preventIdling = () => {
		request.post(
			'http://localhost:6800/jsonrpc',
			{
				json: {
					jsonrpc: '2.0',
					method: 'aria2.getGlobalStat',
					id: 'preventIdling',
					params: [`token:${SECRET}`]
				}
			},
			async (err, resp, body) => {
				console.log('preventIdling: getGlobalStat response', body)
				const { numActive, numWaiting } = body.result
				const numUpload = await readNumUpload()
				console.log(
					'preventIdling: numbers',
					numActive,
					numWaiting,
					numUpload
				)
				if (
					parseInt(numActive) +
						parseInt(numWaiting) +
						parseInt(numUpload) >
					0
				) {
					console.log('preventIdling: make request to prevent idling')
					request(APP_URL)
				}
			}
		)
		setTimeout(preventIdling, 15 * 60 * 1000) // 15 min
	}
	preventIdling()
}
