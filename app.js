const express = require('express')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const request  = require('request')
const Promise  = require('bluebird')
const { createCanvas, loadImage } = require('canvas')
const app = express()
const port = 3000

const YOUTUBE_CHANNEL_ID = ''
const YOUTUBE_API_KEY = ''
const YOUTUBE_API_URL = String.raw`https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=9`
const THUMBNAIL_WIDTH = 480
const THUMBNAIL_HEIGHT = 360
const COLLAGE_COLS = 3
const COLLAGE_ROWS = 3
const CACHE_HOURS = 0
const CACHE_MINUTES = 5
const CACHE_TIME = (CACHE_MINUTES * 60 * 1000) + (CACHE_HOURS * 60 * 60 * 1000)
const CANVAS_WIDTH = THUMBNAIL_WIDTH * COLLAGE_COLS
const CANVAS_HEIGHT = THUMBNAIL_HEIGHT * COLLAGE_ROWS

const downloadThumbnail = (uri) => {
  return new Promise((resolve, reject) => {
    let data

    const stream = request(uri)
    stream.on("data", (chunk) => data = data ? Buffer.concat([data, chunk]) : chunk)
    stream.on("error", reject)
    stream.on("end", () => resolve(data))
  })
}

const getMostRecentFile = (dir) => {
  const files = orderReccentFiles(dir)
  return files.length ? files[0] : undefined
}

const orderReccentFiles = (dir) => {
  return fs.readdirSync(dir)
    .filter((file) => fs.lstatSync(path.join(dir, file)).isFile())
    .map((file) => ({ file, mtime: fs.lstatSync(path.join(dir, file)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
}


app.get('/youtube/collage', (req, res) => {


  let current_time = new Date().getTime()
  let last_cache_file = getMostRecentFile(__dirname + '/cache/').file
  let cache_file_time = last_cache_file.replace('collage_cache_', '').replace('.png', '')
  
  if (cache_file_time > current_time) {
  	res.sendFile(__dirname + `/cache/${last_cache_file}`)
	return
	
  } else {
  	
  	const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
	const ctx = canvas.getContext("2d");
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	let xoffset = 0
	let yoffset = 0
	let count = 0

  	axios.get(YOUTUBE_API_URL)
	  .then((response) => {
	  	let sources = []
		for(var i in response.data.items) {
		  var item = response.data.items[i]
		  var thumbnails = item.snippet.thumbnails['high']
		  sources.push(thumbnails.url)
		}
		return sources
	  }).then((sources) => {
	  		
	  	return Promise
		 .map(sources, downloadThumbnail)
		 .each((photoBuffer, i) => {
			loadImage(photoBuffer).then((image) => {
			   ctx.drawImage(image, xoffset, yoffset, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
			   xoffset += THUMBNAIL_WIDTH
			   count += 1
			   if(count % COLLAGE_COLS == 0){
			   		yoffset += THUMBNAIL_HEIGHT
			   		xoffset = 0
			   }
		 	})
		 })
	  
	  }).then((p) => {

		 const date = new Date().getTime() + CACHE_TIME;
		 let cache_filename = String.raw`collage_cache_${date}.png`
		 
		 canvas.toBuffer(function (err, buf) {
			if (err) throw err;
			fs.writeFileSync(__dirname + `/cache/${cache_filename}`, buf);
			res.sendFile(__dirname + `/cache/${cache_filename}`)
		});
	
	 	 	 	 
	});
  
  }
  
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
