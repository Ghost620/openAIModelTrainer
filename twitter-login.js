const express = require('express');
const session = require('express-session');
const request = require('undici').request;
const twitterOAuth2 = require('twitter-oauth2').twitterOAuth2;
const crypto = require('crypto');

const router = express.Router()

router.use(session({
  name: crypto.randomBytes(32).toString('hex').slice(0, 10),
  secret: [crypto.randomBytes(32).toString('hex')],
  resave: false,
  saveUninitialized: true
}))

router.use(twitterOAuth2({
  client_id: 'RnYzN3MyQmtJTXhTSkhfSnRHelY6MTpjaQ',
  client_secret: 'giVGMttPgN1RhHbb0cuWUn4seai115fNRIKB592XN3YH4WPMmz',
  redirect_uri: 'https://app.no-code-ai-model-builder.com/twitter/callback',
  scope: 'tweet.read users.read offline.access'
}))

router.get('/', async (req, res) => {
  const tokenSet = req.session.tokenSet;

  const { body } = await request('https://api.twitter.com/2/users/me',
    {
      headers: {
        Authorization: `Bearer ${tokenSet?.access_token}`
      }
    });

  const datas = await body.json()

  const user = {
    userId: datas.data.id,
    userName: datas.data.username,
    userToken: req.session.tokenSet.access_token,
    userRefreshToken: req.session.tokenSet.refresh_token
  }

  res.redirect(`https://no-code-ai-model-builder.com/version-test/twitter-login?userId=${user.userId}&userName=${user.userName}&userToken=${user.userToken}&userRefreshToken=${user.userRefreshToken}`)

})

router.get('/callback', async (req, res) => {
  res.send({ 'login': 'successful' })
})

module.exports = router