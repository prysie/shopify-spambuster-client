const sjcl = require('sjcl')

const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production' ? 'https://a8w3q11yde.execute-api.eu-west-1.amazonaws.com/prod' : 'https://ykrlxfdod7.execute-api.eu-west-1.amazonaws.com/dev',
  SCRIPTSRC: process.env.NODE_ENV === 'production' ? 'spambuster.js' : 'spambuster-dev.js'
}

console.log('Spambuster v2.1.7 - ' + process.env.NODE_ENV)

window.$(function ($) {
  const mnslpPost = (url, data, callback) => {
    const xhr = new window.XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.onreadystatechange = () => {
      if (xhr.readyState === window.XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          callback(null, xhr.responseText)
        } else {
          const error = 'mnslpPost request failed.'
          callback(error)
        }
      }
    }
    xhr.send(JSON.stringify(data))
  }

  const SCRIPTSRC = config.SCRIPTSRC
  const BACKEND_URL = config.BACKEND_URL
  const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js'
  const RECAPTCHA_TEXT = '' +
    '<div class="mssb-rc-text">' +
    'This site is protected by reCAPTCHA and the Google' +
    ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
    ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.' +
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
    const scriptSrcSegs = scripts[i].src.split('/')
    const script = scriptSrcSegs[scriptSrcSegs.length - 1]
    const src = script.substring(0, script.indexOf('?'))
    if (src === SCRIPTSRC) {
      rcSiteKey = script.substring((src + '?rcSiteKey=').length)
      rcSiteKey = rcSiteKey.substring(0, rcSiteKey.indexOf('&'))

      const index = script.indexOf('contactEnabled=')
      contactEnabled = index > -1 ? script.substring(index + 'contactEnabled='.length, script.indexOf('&', index)) === 'true' : false
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

            /* $.ajax(BACKEND_URL + '/verify', {
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
            }) */
            mnslpPost(BACKEND_URL + '/verify', data, (error, data) => {
              if (error !== null) {
                throw new Error(error)
              }
              data = JSON.parse(data)
              if (parseFloat(data.score) > 0.5) {
                canSubmitCommentForm = true
                $newCommentForm.submit()
              } else {
                window.alert('The spam protection system did now allow this comment.\nIf this is not spam please verify your internet connection or contact us via email.')
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

            /* $.ajax(BACKEND_URL + '/verifyonly', {
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
            }) */
            mnslpPost(BACKEND_URL + '/verifyonly', data, (error, data) => {
              if (error !== null) {
                throw new Error(error)
              }
              data = JSON.parse(data)
              if (parseFloat(data.score) > 0.5) {
                callback(null)
              } else {
                window.alert('The spam protection system did now allow this submission.\nIf this is not spam please verify your internet connection or contact us via email.')
              }
            })
          })
      } catch (error) {
        console.error(error)
        window.alert('Error submitting. Please try again at a later time.')
      }
    })
  }

  const contactVerifyReCaptcha = function ($verifyForm) {
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

            /* $.ajax(BACKEND_URL + '/verifyonly', {
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
            }) */
            mnslpPost(BACKEND_URL + '/verifyonly', data, (error, data) => {
              if (error !== null) {
                throw new Error(error)
              }
              data = JSON.parse(data)
              if (parseFloat(data.score) > 0.5) {
                canSubmitContactForm = true
                $verifyForm.submit()
              } else {
                window.alert('The spam protection system did now allow this submission.\nIf this is not spam please verify your internet connection or contact us via email.')
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
    hasForm = true
    $contactForm.on('submit', function (e) {
      console.log('submit!')
      const middleMan = function () {
        contactVerifyReCaptcha(e.target)
      }
      
      if (canSubmitContactForm === false) {
        setTimeout(middleMan, 1)
      }
      return false
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
