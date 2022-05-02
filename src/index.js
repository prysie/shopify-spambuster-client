const sjcl = require('sjcl')

const manasloopSpambuster = () => {
  console.log('Spambuster v2.3.00 - ' + process.env.NODE_ENV)

  const config = {
    BACKEND_URL: process.env.NODE_ENV === 'production' ? 'https://qorqmyn3zb.execute-api.eu-west-1.amazonaws.com/prod' : 'https://ewwntzz1i2.execute-api.eu-west-1.amazonaws.com/dev',
    SCRIPTSRC: process.env.NODE_ENV === 'production' ? 'spambuster.js' : 'spambuster-dev.js'
  }

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

  const BACKEND_URL = config.BACKEND_URL
  const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js'
  /* const RECAPTCHA_TEXT = '' +
    '<div class="mssb-rc-text">' +
    'This site is protected by reCAPTCHA and the Google' +
    ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
    ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.' +
    '</div>' */

  let hasForm = false
  let canSubmitCommentForm = false
  let canSubmitSignupForm = false
  let canSubmitLoginForm = false

  const shop = window.Shopify.shop

  let rcSiteKey = ''
  let contactEnabled = ''

  //var scriptTag = document.getElementById('spambuster')
  //rcSiteKey = scriptTag.getAttribute('data-rcSiteKey')
  //contactEnabled = scriptTag.getAttribute('data-contactEnabled')
  const data = {
    shop: shop,
  }

  mnslpPost(BACKEND_URL + '/queryForParams', data, (error, data) => {
    if (error !== null) {
      throw new Error(error)
    }
    data = JSON.parse(data)
    rcSiteKey = data.rcSiteKey
  })
  
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

  const $newCommentForm = document.querySelectorAll('#comment_form')
  const $contactForm = document.querySelectorAll('form.contact-form')
  const $signupForm = document.querySelectorAll('#RegisterForm')
  const $loginForm = document.querySelectorAll('#customer_login')

  // We generate the hash locally because we do not want to send user data to our servers.
  // If the same person makes the same comment on the site we have a collision ->
  // result is simply that one risks being marked as spam, which makes sense since it is duplication
  const getHash = function (name, email, body, shop) {
    const out = sjcl.hash.sha256.hash(name + email + body + shop)
    const hash = sjcl.codec.hex.fromBits(out)
    return hash
  }

  // Assumption: only suppor for 1 comment form and this function is only called if such a form is rendered
  const commentVerifyReCaptcha = function () {
    if (!window.grecaptcha) {
      console.error('Error with Google ReCaptcha on comment form')
      return
    }

    window.grecaptcha.ready(function () {
      try {
        window.grecaptcha.execute(rcSiteKey, { action: 'blog_comment' })
          .then(function (token) {
            const commentName = $newCommentForm[0].querySelectorAll('input[name="comment[author]"]')[0].value
            const commentEmail = $newCommentForm[0].querySelectorAll('input[name="comment[email]"]')[0].value
            const commentBody = $newCommentForm[0].querySelectorAll('textarea[name="comment[body]"]')[0].value

            const data = {
              shop: shop,
              token: token,
              commentHash: getHash(commentName, commentEmail, commentBody, shop)
            }

            mnslpPost(BACKEND_URL + '/verify', data, (error, data) => {
              if (error !== null) {
                throw new Error(error)
              }
              data = JSON.parse(data)
              if (parseFloat(data.score) > 0.5) {
                canSubmitCommentForm = true
                $newCommentForm[0].submit()
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

            mnslpPost(BACKEND_URL + '/verifyonly', data, (error, data) => {
              if (error !== null) {
                throw new Error(error)
              }
              data = JSON.parse(data)
              if (parseFloat(data.score) > 0.5) {
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
      $signupForm[0].submit()
    })
  }

  const loginVerifyReCaptcha = function () {
    verifyReCaptcha('login', function (error) {
      if (error !== null) {
        console.error(error)
      }
      canSubmitLoginForm = true
      $loginForm[0].submit()
    })
  }

  if ($newCommentForm.length > 0) {
    hasForm = true
    $newCommentForm[0].addEventListener('submit', function (event) {
      if (canSubmitCommentForm === false) {
        setTimeout(commentVerifyReCaptcha, 1)
        event.preventDefault()
        event.stopPropagation()
      }
    })

    const recaptchaTextElement = document.createElement('div')
    recaptchaTextElement.className = 'mssb-rc-text'
    recaptchaTextElement.innerHTML = 'This site is protected by reCAPTCHA and the Google' +
      ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
      ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.'
    $newCommentForm[0].appendChild(recaptchaTextElement)
  }

  if ($contactForm.length > 0 && contactEnabled === true) {
    hasForm = true

    $contactForm[0].addEventListener('submit', function (event) {
      const target = event.target

      const middleMan = function () {
        contactVerifyReCaptcha(target)
      }

      setTimeout(middleMan, 1)

      event.preventDefault()
      event.stopPropagation() // The submit called from the contactVerifyReCaptcha function does not trigger this handler
    })

    const recaptchaTextElement = document.createElement('div')
    recaptchaTextElement.className = 'mssb-rc-text'
    recaptchaTextElement.innerHTML = 'This site is protected by reCAPTCHA and the Google' +
      ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
      ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.'
    $contactForm[0].appendChild(recaptchaTextElement)
  }

  if ($signupForm.length > 0 && contactEnabled === true) {
    hasForm = true

    $signupForm[0].addEventListener('submit', function (event) {
      if (canSubmitSignupForm === false) {
        setTimeout(signupVerifyReCaptcha, 1)
        event.preventDefault()
        event.stopPropagation()
      }
    })

    const recaptchaTextElement = document.createElement('div')
    recaptchaTextElement.className = 'mssb-rc-text'
    recaptchaTextElement.innerHTML = 'This site is protected by reCAPTCHA and the Google' +
      ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
      ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.'
    $signupForm[0].appendChild(recaptchaTextElement)
  }

  if ($loginForm.length > 0 && contactEnabled === true) {
    hasForm = true

    $loginForm[0].addEventListener('submit', function (event) {
      if (canSubmitLoginForm === false) {
        setTimeout(loginVerifyReCaptcha, 1)
        event.preventDefault()
        event.stopPropagation()
      }
    })

    const recaptchaTextElement = document.createElement('div')
    recaptchaTextElement.className = 'mssb-rc-text'
    recaptchaTextElement.innerHTML = 'This site is protected by reCAPTCHA and the Google' +
      ' <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and' +
      ' <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.'
    $loginForm[0].appendChild(recaptchaTextElement)
  }

  if (hasForm === true) {
    document.head.insertAdjacentHTML('beforeend', '<style>.grecaptcha-badge { visibility: hidden; }</style>')
  }
}

if (document.readyState !== 'loading') {
  manasloopSpambuster()
} else {
  document.addEventListener('DOMContentLoaded', manasloopSpambuster)
}
