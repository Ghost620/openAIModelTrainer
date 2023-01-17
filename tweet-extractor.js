const express = require('express');
const TwitterApi = require('twitter-api-v2').TwitterApi;
const fs = require("fs")
const stringify = require('csv-stringify').stringify
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const router = express.Router()
const twitterClient = new TwitterApi('AAAAAAAAAAAAAAAAAAAAAGo2lAEAAAAA9Jp%2FHIWaq%2FhNTaQqwI9L9%2FKGwZU%3DLScKzuLTNnHXXCQwS3VzGvaDlzKFFLPhDtD7sonHd0wUyVFvRJ');
const readOnlyClient = twitterClient.readOnly;

router.post("/", async (req, response, next) => {

  const data = req.body
  const dataKeys = Array.from(Object.keys(data))

  if (dataKeys.length === 1 && dataKeys[0] === 'username') {

    await readOnlyClient.v2.userByUsername(
      data['username'],
      { "user.fields": ["description", "profile_image_url"] }
    )
      .then((res) => {
        response.status(200).send(res)
      }).catch((err) => {
        response.status(err.code).send(err.data)
      })

  } else {

    var cond = false
    cond = (dataKeys.includes("user_id") && data['user_id'] != '') ? (dataKeys.includes("username") && data['username'] != '') ? (dataKeys.includes("twitter_id") && data['twitter_id'] != '') ? (dataKeys.includes("env") && data['env'] != '') ? (data['env'] == 'dev' || data['env'] == 'prd') ? (dataKeys.includes("results")) ? true : response.status(500).send({ 'error': "Results not provided" }) : response.status(500).send({ 'error': "env should be either dev or prd" }) : response.status(500).send({ 'error': "env not provided" }) : response.status(500).send({ 'error': "Twitter ID not provided" }) : response.status(500).send({ 'error': "Username not provided" }) : response.status(500).send({ 'error': "User ID not provided" })

    if (cond === true) {

      let alldataCsv = [];
      let token = ''
      let end = false
      var params = {
        exclude: ["replies", "retweets"],
        "tweet.fields": ["in_reply_to_user_id", "referenced_tweets"],
        max_results: 100,
      }
    
      while (true) {
        if ( alldataCsv.length >= parseInt(data['results']) || end === true ){ break }
        token ? (params.pagination_token = token) : token = ''

        await readOnlyClient.v2.userTimeline( data["twitter_id"], params )
        .then(async (res) => {
          res._realData.meta.next_token ? token = res._realData.meta.next_token : end = true

          if (!res._realData.data){
            end = true
          } else {
            const dataCsv = res._realData.data.map( (tweet) => (
              tweet.referenced_tweets ? null : { Prompt: `Write me a tweet, under 280 characters, make it interesting and useful`, Completion: tweet.text.replaceAll(/(?:https?|ftp):\/\/[\n\S]+/g, '').replaceAll(/(\s|)@[a-zA-Z0-9]+/g, '').trim() }
            ))

            Promise.all([dataCsv]).then((values) => {
              alldataCsv = alldataCsv.concat(values[0].filter(Boolean))
            });

          }
        })
        .catch(function(error) {
          response.status(406).send({ error: error.cause, message: "Failed to create Tweets file" })
        });
      }

      stringify(alldataCsv.slice(0, data['results']), {
        header: true,
        columns: { Prompt: "Prompt", Completion: "Completion" }
      }, async (err, output) => {
        const filename = `tweets-${data['username']}-${uuidv4().slice(0, 5)}.csv`
        fs.writeFileSync(filename, output);
        var filedata = fs.readFileSync(filename);

        var dataDb = JSON.stringify({
          "upload": {
            "filename": filename,
            "contents": filedata.toString('base64'),
            "private": false
          }
        });

        const URL = (data['env'] == "dev") ? `https://no-code-ai-model-builder.com/version-test/api/1.1/obj/user/${data['user_id']}` : `https://no-code-ai-model-builder.com/api/1.1/obj/user/${data['user_id']}`

        var config = {
          method: 'patch',
          url: URL,
          headers: {
            'Authorization': 'Bearer a93b979a285cc2cc945e767a8d078dad',
            'Content-Type': 'application/json'
          },
          data: dataDb
        };

        axios(config)
          .then(() => {
            fs.unlink(filename, (err) => {
              if (err) { throw err }
              response.status(200).send(alldataCsv)
            })
          })
          .catch(function(error) {
            fs.unlink(filename, (err) => {
              response.status(406).send({ error: error.cause, message: "Failed to upload Tweets file " })
            })
          });

      });
      
    }
  }
})

module.exports = router