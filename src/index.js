const sjcl = require('sjcl')

const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production' ? 'https://a8w3q11yde.execute-api.eu-west-1.amazonaws.com/prod' : 'https://ykrlxfdod7.execute-api.eu-west-1.amazonaws.com/dev',
  SCRIPTSRC: process.env.NODE_ENV === 'production' ? 'https://www.chrishjorth.com/shopify-spambuster-client/build/spambuster.js' : 'https://www.chrishjorth.com/shopify-spambuster-client/build/spambuster-dev.js'
}

console.log('Spambuster v2.1.0 - ' + process.env.NODE_ENV)

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

  let hasForm = false
  let canSubmitCommentForm = false
  let canSubmitContactForm = false
  let canSubmitSignupForm = false
  let canSubmitLoginForm = false

  const shop = window.Shopify.shop

  const scripts = document.getElementsByTagName('script')
  let rcSiteKey = ''
  let contactEnabled = ''
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    const src = script.src.substring(0, script.src.indexOf('?'))
    if (src === SCRIPTSRC) {
      rcSiteKey = script.src.substring((src + '?rcSiteKey=').length)
      rcSiteKey = rcSiteKey.substring(0, rcSiteKey.indexOf('&'))

      const index = script.src.indexOf('contactEnabled=')
      contactEnabled = index > -1 ? script.src.substring(index + 'contactEnabled='.length, script.src.indexOf('&', index)) === 'true' : false
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
  const $contactForm = $('form.contact-form')
  const $signupForm = $('#RegisterForm')
  const $loginForm = $('#customer_login')

  // We generate the hash locally because we do not want to send user data to our servers.
  // If the same person makes the same comment on the site we have a collision ->
  // result is simply that one risks being marked as spam, which makes sense since it is duplication
  const getHash = function (name, email, body, shop) {
    const out = sjcl.hash.sha256.hash(name + email + body + shop)
    const hash = sjcl.codec.hex.fromBits(out)
    return hash
  }

  const commentVerifyReCaptcha = function () {
    if (!window.grecaptcha) {
      console.error('Error with Google ReCaptcha on comment form')
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
                  canSubmitCommentForm = true
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

  const verifyReCaptcha = function (action, callback) {
    if (!window.grecaptcha) {
      console.error('Error with Google ReCaptcha on contact form')
      return
    }

    window.grecaptcha.ready(function () {
      try {
        window.grecaptcha.execute(rcSiteKey, { action: action })
          .then(function (token) {
            const data = {
              shop: shop,
              token: token
            }

            $.ajax(BACKEND_URL + '/verifyonly', {
              method: 'POST',
              contentType: 'application/json',
              data: JSON.stringify(data),
              processData: false,
              dataType: 'text',
              success: function (data) {
                data = JSON.parse(data)
                if (parseFloat(data.score) > 0.5) {
                  callback(null)
                } else {
                  window.alert('The spam protection system did now allow this submission.\nIf this is not spam please verify your internet connection or contact us via email.')
                }
              },
              error: function (jqXHR, textStatus, errorThrown) {
                console.error(textStatus)
              }
            })
          })
      } catch (error) {
        console.error(error)
        window.alert('Error submitting. Please try again at a later time.')
      }
    })
  }

  const contactVerifyReCaptcha = function () {
    if (!window.grecaptcha) {
      console.error('Error with Google ReCaptcha on contact form')
      return
    }

    window.grecaptcha.ready(function () {
      try {
        window.grecaptcha.execute(rcSiteKey, { action: 'contact' })
          .then(function (token) {
            const data = {
              shop: shop,
              token: token
            }

            $.ajax(BACKEND_URL + '/verifyonly', {
              method: 'POST',
              contentType: 'application/json',
              data: JSON.stringify(data),
              processData: false,
              dataType: 'text',
              success: function (data) {
                data = JSON.parse(data)
                if (parseFloat(data.score) > 0.5) {
                  canSubmitContactForm = true
                  $contactForm.submit()
                } else {
                  window.alert('The spam protection system did now allow this submission.\nIf this is not spam please verify your internet connection or contact us via email.')
                }
              },
              error: function (jqXHR, textStatus, errorThrown) {
                console.error(textStatus)
              }
            })
          })
      } catch (error) {
        console.error(error)
        window.alert('Error submitting. Please try again at a later time.')
      }
    })
  }

  const signupVerifyReCaptcha = function () {
    verifyReCaptcha('signup', function (error) {
      if (error !== null) {
        console.error(error)
      }
      canSubmitSignupForm = true
      $signupForm.submit()
    })
  }

  const loginVerifyReCaptcha = function () {
    verifyReCaptcha('login', function (error) {
      if (error !== null) {
        console.error(error)
      }
      canSubmitLoginForm = true
      $loginForm.submit()
    })
  }

  if ($newCommentForm.length > 0) {
    hasForm = true
    $newCommentForm.on('submit', function () {
      if (canSubmitCommentForm === false) {
        setTimeout(commentVerifyReCaptcha, 1)
      }
      return canSubmitCommentForm
    })

    $newCommentForm.append(RECAPTCHA_TEXT)
  }

  if ($contactForm.length > 0 && contactEnabled === true) {
    console.log($contactForm)
    hasForm = true
    $contactForm.on('submit', function () {
      if (canSubmitContactForm === false) {
        setTimeout(contactVerifyReCaptcha, 1)
      }
      return canSubmitContactForm
    })

    $contactForm.append(RECAPTCHA_TEXT)
  }

  if ($signupForm.length > 0 && contactEnabled === true) {
    hasForm = true

    $signupForm.on('submit', function () {
      if (canSubmitSignupForm === false) {
        setTimeout(signupVerifyReCaptcha, 1)
      }
      return canSubmitSignupForm
    })

    $signupForm.append(RECAPTCHA_TEXT)
  }

  if ($loginForm.length > 0 && contactEnabled === true) {
    hasForm = true

    $loginForm.on('submit', function () {
      if (canSubmitLoginForm === false) {
        setTimeout(loginVerifyReCaptcha, 1)
      }
      return canSubmitLoginForm
    })

    $loginForm.append(RECAPTCHA_TEXT)
  }

  if (hasForm === true) {
    document.head.insertAdjacentHTML('beforeend', '<style>.grecaptcha-badge { visibility: hidden; }</style>')
  }
})
