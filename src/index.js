const sjcl = require('sjcl')

const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production' ? 'https://a8w3q11yde.execute-api.eu-west-1.amazonaws.com/prod' : 'https://ykrlxfdod7.execute-api.eu-west-1.amazonaws.com/dev',
  SCRIPTSRC: process.env.NODE_ENV === 'production' ? 'https://www.chrishjorth.com/shopify-spambuster-client/build/spambuster.js' : 'https://www.chrishjorth.com/shopify-spambuster-client/build/spambuster-dev.js'
}

console.log('Spambuster v1.0.1 - ' + process.env.NODE_ENV)

window.$(function ($) {
  const SCRIPTSRC = config.SCRIPTSRC
  const BACKEND_URL = config.BACKEND_URL
  const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js'
  const RECAPTCHA_TEXT = '' +
    '<div class="mssb-rc-text">' +
    'This site is protected by reCAPTCHA and the Google' +
    ' <a href="https://policies.google.com/privacy">Privacy Policy</a> and' +
    ' <a href="https://policies.google.com/terms">Terms of Service</a> apply.' +
    '</div>'

  let canSubmitForm = false

  const shop = window.Shopify.shop

  const scripts = document.getElementsByTagName('script')
  let rcSiteKey = ''
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    const src = script.src.substring(0, script.src.indexOf('?'))
    if (src === SCRIPTSRC) {
      rcSiteKey = script.src.substring((src + '?rcSiteKey=').length)
      rcSiteKey = rcSiteKey.substring(0, rcSiteKey.indexOf('&'))
    }
  }

  // https://developers.google.com/recaptcha/docs/faq
  // https://github.com/google/google-api-javascript-client/issues/397
  // https://community.shopify.com/c/Technical-Q-A/GTM-on-Shopify-Plus-store-now-Reporting-CSP-issues/m-p/666613
  // Shopify CSP headers are set to report scripts but still allow them to run
  const nonce = 'this_is_my_nonce'
  const scriptNode = document.createElement('script')
  scriptNode.src = RECAPTCHA_SCRIPT_SRC + '?render=' + rcSiteKey
  scriptNode.type = 'text/javascript'
  scriptNode.charset = 'utf-8'
  scriptNode.nonce = nonce
  document.getElementsByTagName('head')[0].appendChild(scriptNode)

  const $newCommentForm = $('#comment_form')

  // We generate the hash locally because we do not want to send user data to our servers.
  // If the same person makes the same comment on the site we have a collision ->
  // result is simply that one risks being marked as spam, which makes sense since it is duplication
  const getHash = function (name, email, body, shop) {
    const out = sjcl.hash.sha256.hash(name + email + body + shop)
    const hash = sjcl.codec.hex.fromBits(out)
    return hash
  }

  const verifyReCaptcha = function () {
    if (!window.grecaptcha) {
      console.error('Error with Google ReCaptcha')
      return
    }

    window.grecaptcha.ready(function () {
      try {
        window.grecaptcha.execute(rcSiteKey, { action: 'blog_comment' })
          .then(function (token) {
            const commentName = $('input[name="comment[author]"]', $newCommentForm).val()
            const commentEmail = $('input[name="comment[email]"]', $newCommentForm).val()
            const commentBody = $('textarea[name="comment[body]"]', $newCommentForm).val()

            const data = {
              shop: shop,
              token: token,
              commentHash: getHash(commentName, commentEmail, commentBody, shop)
            }

            $.ajax(BACKEND_URL + '/verify', {
              method: 'POST',
              contentType: 'application/json',
              data: JSON.stringify(data),
              processData: false,
              dataType: 'text',
              success: function (data) {
                data = JSON.parse(data)
                if (parseFloat(data.score) > 0.5) {
                  canSubmitForm = true
                  $newCommentForm.submit()
                } else {
                  window.alert('The spam protection system did now allow this comment.\nIf this is not spam please verify your internet connection or contact us via email.')
                }
              },
              error: function (jqXHR, textStatus, errorThrown) {
                console.error(textStatus)
              }
            })
          })
      } catch (error) {
        console.error(error)
        window.alert('Error posting the comment. Please try again at a later time.')
      }
    })
  }

  if ($newCommentForm.length > 0) {
    $newCommentForm.on('submit', function () {
      if (canSubmitForm === false) {
        setTimeout(verifyReCaptcha, 1)
      }
      return canSubmitForm
    })

    $newCommentForm.append(RECAPTCHA_TEXT)

    document.head.insertAdjacentHTML('beforeend', '<style>.grecaptcha-badge { visibility: hidden; }</style>')
  }
})
